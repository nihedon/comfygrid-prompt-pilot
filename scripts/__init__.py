import asyncio
import functools
import gzip
import json
import os
import sqlite3
import subprocess
from collections import Counter, defaultdict
from concurrent.futures import Future, ThreadPoolExecutor
from contextlib import suppress
from pathlib import Path
from typing import Any, Dict, Tuple
from urllib.parse import quote

import piexif
import piexif.helper
import polars as pl
from fastapi import FastAPI
from PIL import Image, UnidentifiedImageError

import modules.shared as shared
from modules import script_callbacks
from modules.options import OptionForms, OptionInfo

from ..scripts.database import DBManager

EXTENSION_ID = "prompt_pilot"
EXTENSION_NAME = "Prompt Pilot"
API_PREFIX = f"/{EXTENSION_ID}/v1"
TAGS_REPOSITORY = "https://github.com/nihedon/prompt-tags.git"

PNG = ".png"
WEBP = ".webp"
EXTENSIONS = [PNG, WEBP]
ALLOWED_PREVIEW_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"]

analysis_directory_choices = [
    "<samples>",
    "<txt2img_samples>",
    "<img2img_samples>",
    "<extras_samples>",
    "<save>"
]
post_count_threshold_default = 10
tag_source_default = "danbooru.donmai.us"
always_underscore_tags_default = "score_9, score_8_up, score_8, score_7_up, score_7, score_6_up, score_6, score_5_up, score_5, score_4_up, score_4"
always_underscore_tags_default += "\nsource_pony, source_furry, source_cartoon, source_anime"
always_underscore_tags_default += "\nrating_safe, rating_questionable, rating_explicit"

extension_dir = str(Path(__file__).parents[1])


def create_table() -> None:
    db_path = os.path.join(extension_dir, "cache.db")
    with DBManager(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tfiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                directory TEXT,
                name TEXT,
                timestamp REAL
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS tfiles_directory_name ON tfiles(directory, name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS tfiles_directory_timestamp ON tfiles(directory, timestamp DESC);")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ttags (
                id INTEGER,
                tag TEXT,
                tag_order INTEGER
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS ttags_tag ON ttags(tag)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ttags_id_order ON ttags(id, tag_order);")


def init(app: FastAPI) -> Dict[str, Any]:
    tag_models = _build_tag_models()
    lora_models = _build_lora_models(app)

    return {
        "tagModels": tag_models,
        "loraModels": lora_models
    }


def _load_tag_data_from_csv_file() -> Dict[str, Dict[str, Any]]:
    all_tags = {}
    tag_source = shared.opts.data.get(f'{EXTENSION_ID}_tag_source', tag_source_default)

    tags_csv_path = os.path.join(extension_dir, "tags", tag_source, "tags.csv")
    if os.path.exists(tags_csv_path):
        df = pl.read_csv(tags_csv_path, columns=["name", "category", "post_count"])
        for row in df.rows():
            tag = row[0].replace("_", " ")
            post_count = int(row[2])
            all_tags[tag] = {
                "post_count": post_count,
                "category": int(row[1]),
                "aliases": []
            }

        aliases_csv_path = os.path.join(extension_dir, "tags", tag_source, "tag_aliases.csv")
        if os.path.exists(aliases_csv_path):
            df = pl.read_csv(aliases_csv_path, columns=["antecedent_name", "consequent_name"])
            for row in df.rows():
                antecedent_name = row[0].replace("_", " ")
                consequent_name = row[1].replace("_", " ")
                if consequent_name in all_tags:
                    all_tags[consequent_name]["aliases"].append(antecedent_name)

    return all_tags


def _build_tag_models() -> Tuple[Dict, Dict]:
    tag_counter = {}

    tag_model = _load_tag_data_from_csv_file()
    alias_to_tag = {}
    for k, v in tag_model.items():
        for alias in v["aliases"]:
            alias_to_tag.setdefault(alias, []).append(k)
        v["use_count"] = 0

    for tag, use_count in tag_counter.items():
        tag = tag.replace("_", " ")
        if tag in tag_model:
            tag_model[tag]["use_count"] = use_count
        elif tag in alias_to_tag:
            for alias in alias_to_tag[tag]:
                tag_model[alias]["use_count"] += use_count
        else:
            tag_model[tag] = {
                "post_count": 0,
                "use_count": use_count,
                "category": "custom",
                "aliases": []
            }

    post_count_threshold = shared.opts.data.get("post_count_threshold", post_count_threshold_default)
    for tag in list(tag_model.keys()):
        data = tag_model[tag]
        if data["post_count"] < post_count_threshold and data["use_count"] == 0:
            del tag_model[tag]

    return tag_model


def _build_lora_models(app: FastAPI) -> Dict:
    lora_model = {}
    try:
        comfy_path = app.state.comfy_service.comfyui_path
        loras_dir = os.path.join(comfy_path, "models", "loras")

        all_files = set()
        for root, __, files in os.walk(loras_dir):
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), loras_dir)
                all_files.add(rel_path.replace("\\", "/"))

        loras = [f for f in all_files if f.lower().endswith(".safetensors")]

        for model_path in loras:
            lora_name = os.path.splitext(os.path.basename(model_path))[0]
            lora_name_lower = lora_name.lower().replace("_", " ")

            civitai_info = _find_civitai_info(comfy_path, model_path)
            base_model = civitai_info.get("baseModel", None)
            trigger_words = civitai_info.get("trainedWords", [])

            preview_file = _find_preview_file_cached(model_path, all_files)

            search_words = [lora_name_lower]
            if base_model:
                search_words.append(base_model.lower().strip())
            if len(trigger_words) > 0:
                trigger_words = ",".join(trigger_words).split(",")
                for trigger_word in [w.lower().strip() for w in trigger_words]:
                    if trigger_word != "":
                        search_words.append(trigger_word)

            lora_model[lora_name] = {'search_words': search_words, 'preview_file': preview_file}
    except Exception as e:
        print(f"Error building lora models: {e}")

    return lora_model


@functools.cache
def _find_civitai_info(comfyui_path, path) -> dict[str, Any]:
    if path:
        path_without_ext = os.path.splitext(path)[0]
        civitai_info = f"{path_without_ext}.civitai.info"

        lora_dir = os.path.join(comfyui_path, "models", "loras")
        fullpath = os.path.join(lora_dir, civitai_info)
        if os.path.exists(fullpath):
            try:
                with open(fullpath, "r", encoding="utf-8", errors="replace") as f:
                    return json.load(f)
            except OSError:
                pass
    return {}


def _find_preview_file_cached(path: str, all_files: set) -> str:
    if path:
        path_without_ext = os.path.splitext(path)[0]
        potential_files = [
            f"{path_without_ext}.{ext}" for ext in ALLOWED_PREVIEW_EXTENSIONS
        ] + [
            f"{path_without_ext}.preview.{ext}" for ext in ALLOWED_PREVIEW_EXTENSIONS
        ]

        for file_name in potential_files:
            normalized = file_name.replace("\\", "/")
            if normalized in all_files:
                quoted_filename = quote(file_name.replace('\\', '/'))
                return f"/comfygrid/api/file=models/loras/{quoted_filename}"
    return "/comfygrid/api/file=html/card-no-preview.png"


def on_app_started(app: FastAPI) -> None:
    init_options()

    output_path = os.path.join(extension_dir, "models.json.gz")
    with gzip.open(output_path, "wt", encoding="utf-8") as f:
        json.dump(init(app), f, ensure_ascii=True, separators=(',', ':'))

    enabled = shared.opts.data.get(f'{EXTENSION_ID}_enabled', True)
    if enabled:
        executor = ThreadPoolExecutor()
        future: Future = executor.submit(functools.partial(init, app))

    @app.post(f"{API_PREFIX}/init")
    async def api_init() -> Any:
        if enabled:
            return await asyncio.to_thread(future.result)
        else:
            return {"tagSuggestModel": {}, "tagAcModel": {}, "loraAcModel": {}}

    @app.post(f"{API_PREFIX}/refresh")
    async def api_refresh() -> Any:
        if enabled:
            lora_models = _build_lora_models(app)
            return {
                "suggestionModels": None,
                "tagModels": None,
                "loraModels": lora_models
            }
        else:
            return {"tagSuggestModel": {}, "tagAcModel": {}, "loraAcModel": {}}


def init_options() -> None:
    maximum_limit_slider_opts = {"minimum": -1, "maximum": 100, "step": 1, "tooltip": None}

    opts = OptionInfo()

    opts.set_option(f"{EXTENSION_ID}_enabled",
                    OptionForms.checkbox("Enabled", True))
    opts.set_option(f"{EXTENSION_ID}_tag_source",
                    OptionForms.dropdown("Source for tag autocompletion", tag_source_default, tag_sources))
    # opts.set_option(f"{EXTENSION_ID}_suggest_enabled",
    #                 OptionForms.checkbox("Enable tag suggestion", True))
    opts.set_option(f"{EXTENSION_ID}_max_results_group0",
                    OptionForms.slider("Maximum results (General tag)", 30, **maximum_limit_slider_opts))
    opts.set_option(f"{EXTENSION_ID}_max_results_group1",
                    OptionForms.slider("Maximum results (Artist tag)", 10, **maximum_limit_slider_opts))
    opts.set_option(f"{EXTENSION_ID}_max_results_group3",
                    OptionForms.slider("Maximum results (Copyright tag)", 10, **maximum_limit_slider_opts))
    opts.set_option(f"{EXTENSION_ID}_max_results_group4",
                    OptionForms.slider("Maximum results (Character tag)", 10, **maximum_limit_slider_opts))
    opts.set_option(f"{EXTENSION_ID}_max_results_group5",
                    OptionForms.slider("Maximum results (Meta tag)", 10, **maximum_limit_slider_opts))
    opts.set_option(f"{EXTENSION_ID}_max_results_groupcustom",
                    OptionForms.slider("Maximum results (Custom Tag)", 20, **maximum_limit_slider_opts))
    opts.set_option(f"{EXTENSION_ID}_max_results_grouplora",
                    OptionForms.slider("Maximum results (Lora)", 100, **maximum_limit_slider_opts))

    opts.set_option(f"{EXTENSION_ID}_using_execCommand",
                    OptionForms.checkbox("Use the deprecated execCommand function to replace text", True))

    opts.set_option(f"{EXTENSION_ID}_post_count_threshold",
                    OptionForms.slider("Threshold for post count", post_count_threshold_default, 0, 1000))

    for tag_source in tag_sources:
        replaced_tag_source = tag_source.replace(".", "_")
        with opts.section(f"{tag_source} tag delimiter"):
            for key, val in [(0, "General"), (1, "Artist"), (3, "Copyright"), (4, "Character"), (5, "Meta"), ("custom", "Custom")]:
                opt_type = OptionForms.radio(f"[{val}] tag delimiter", "auto", choices=["auto", "space", "underscore"])
                opts.set_option(f"{EXTENSION_ID}_{replaced_tag_source}_{key}_tag_delimiter", opt_type)

    opts.set_option(f"{EXTENSION_ID}_always_underscore_tags",
                    OptionForms.textarea("Always use underscores for these tags", always_underscore_tags_default, lines=4))
    opts.set_option(f"{EXTENSION_ID}_always_space_tags",
                    OptionForms.textarea("Always use spaces for these tags", "", lines=4))

    shared.register_option(EXTENSION_ID, EXTENSION_NAME, opts)


def get_tags_from_repository():
    tags_dir = os.path.join(extension_dir, "tags")
    if not os.path.exists(tags_dir):
        os.makedirs(tags_dir, exist_ok=True)
    if not os.listdir(tags_dir):
        subprocess.run(
            ["git", "clone", "--depth=1", TAGS_REPOSITORY, tags_dir],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    elif os.path.exists(os.path.join(tags_dir, ".git")):
        with suppress(subprocess.CalledProcessError):
            subprocess.run(
                ["git", "pull"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                cwd=tags_dir)


get_tags_from_repository()
tag_sources = []
for dir in os.listdir(os.path.join(extension_dir, "tags")):
    if dir != ".git":
        tag_sources.append(dir)

create_table()

script_callbacks.on_app_started(on_app_started)
