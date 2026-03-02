import os
import glob
import requests
import pandas as pd
import zipfile
from tempfile import TemporaryDirectory

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(ROOT, "data")
os.makedirs(DATA_DIR, exist_ok=True)
OUTPUT_DIR = os.path.join(ROOT, "stats")
os.makedirs(OUTPUT_DIR, exist_ok=True)

ENV_FILE = os.path.join(ROOT, ".env")

TOKEN = os.getenv("TOKEN")
if TOKEN is None:
    raise ValueError("TOKEN not found in environment variables.")

# get results from JATOS API
# from https://www.jatos.org/JATOS-API.html
JATOS_URL = "https://factslab.org/jatos/api/v1/results/data"
params = {
    "studyId": 15,
    "componentId": 21,
}

headers = {
    "accept": "application/zip",
    "Authorization": f"Bearer {TOKEN}"
}

# Stream response so we can download large files
response = requests.post(JATOS_URL, headers=headers, params=params, stream=True)
response.raise_for_status()

# Determine filename from Content-Disposition header
cd = response.headers.get("Content-Disposition", "")
filename = cd.split("filename=")[1].strip('"')

# Write file
file = os.path.join(DATA_DIR, filename)
with open(file, "wb") as f:
    for chunk in response.iter_content(chunk_size=8192):
        if chunk:
            f.write(chunk)

# unzip
with TemporaryDirectory() as temp_dir:
    with zipfile.ZipFile(file, "r") as zip_ref:
        zip_ref.extractall(temp_dir)

    # convert txt jsons to one jsonl
    DATA_FILES = glob.glob(os.path.join(temp_dir, "**/*.txt"), recursive=True)

    outfile_path = file.replace(".zip", ".json")
    with open(outfile_path, "w") as outfile:
        for fname in DATA_FILES:
            with open(fname) as infile:
                outfile.writelines(infile.readlines())

os.unlink(file)
file = outfile_path

print(f"Processing file: {file}")
TIMESTAMP = file.split("_")[-1].split(".")[0]
OUTPUT_NAME = f"{OUTPUT_DIR}/{TIMESTAMP}"

# first, we need to preprocess the data
# this happens in place!
with open(file, "r+") as f:
    # replace all instances of "}{" with "}\n{"
    data = f.read().replace("}{", "}\n{").replace("}\n{", "},\n{")

    # rewrite file
    # if the file does not start with "[" and end with "]", add them
    if not data.startswith("["):
        data = "[" + data
    if not data.endswith("]"):
        data = data + "]"
    f.seek(0)
    f.write(data)

# load data
df = pd.read_json(file)

print(df)

# filter English (demo)
df = df[df["id"] != "English"]

# Compute session duration for each row, in seconds
df["duration"] = (df["end"] - df["start"]) / 1000

# minutes
df["duration"] = df["duration"] / 60
df["totalMark"] = df["totalMark"] / 60

# Group by user id and transcription
grouped = df.groupby(["id", "transcription"])

# 1. Compute total time spent per transcription as the sum of durations.
time_spent = grouped["duration"].sum().reset_index()

# 2. For totalMark and totalChar, select the row with the max "end" (the latest datapoint) for each transcription.
latest = grouped.apply(
    lambda x: x.loc[x["end"].idxmax()], include_groups=True
).reset_index(drop=True)
print(latest.columns)
latest = latest[["id", "transcription", "totalMark", "totalChar"]]

# Merge the time spent and latest marking info per transcription.
transcription_stats = pd.merge(time_spent, latest, on=["id", "transcription"])

# 3. Now, aggregate by user id to get overall stats.
user_stats = (
    transcription_stats.groupby("id")
    .agg({"duration": "sum", "totalMark": "sum", "totalChar": "sum"})
    .reset_index()
)

# Rename columns if needed
user_stats.rename(columns={"duration": "totalTimeSpent"}, inplace=True)

print("Per transcription stats:")
print(transcription_stats)
print("\nAggregated per user stats:")
print(user_stats)

# save to file
transcription_stats.to_csv(OUTPUT_NAME + "_by_ts.csv", index=False)
user_stats.to_csv(OUTPUT_NAME + "_by_usr.csv", index=False)
