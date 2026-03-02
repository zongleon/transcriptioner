import glob
import pandas as pd

PRINT_USERS = False
MINUTES = True

DATA_FILES = glob.glob("../data2/jatos_results_data_*.json")

for file in DATA_FILES:
    print(f"Processing file: {file}")
    TIMESTAMP = file.split("_")[-1].split(".")[0]
    OUTPUT_NAME = f"../stats/{TIMESTAMP}"

    if PRINT_USERS:
        df = pd.read_csv("../assigned_files.csv")

        df = df.drop_duplicates(subset=["Name"])[["Name", "id"]]

        print(df)

    # analyze results if stats file doesn't exist
    if glob.glob(OUTPUT_NAME + "_by_usr.csv"):
        print(f"Stats file {OUTPUT_NAME}_by_usr.csv already exists, skipping...")
        continue

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

    #     print(data[:1000])

    # load data
    df = pd.read_json(file)

    print(df)

    # filter English (demo)
    df = df[df["id"] != "English"]

    # Compute session duration for each row, in seconds
    df["duration"] = (df["end"] - df["start"]) / 1000

    if MINUTES:
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


# read all the generated stats files and plot line chart
# of each user's transcription progress (totalMark) for each
# timestamp
import seaborn as sns
import matplotlib.pyplot as plt

stats = glob.glob("../stats/*_by_usr.csv")
all_stats = []
for file in stats:
    timestamp = file.split("_")[0].split("/")[-1]
    df = pd.read_csv(file)
    df["timestamp"] = timestamp
    df["timestamp"] = pd.to_datetime(df["timestamp"], format="%Y%m%d%H%M%S")
    all_stats.append(df)

all_stats_df = pd.concat(all_stats)

# convert to hours
all_stats_df["totalMark"] = all_stats_df["totalMark"] / 60

# plot the total for all users as a line as well
total_df = (
    all_stats_df.groupby("timestamp")["totalMark"]
    .sum()
    .reset_index()
    .rename(columns={"totalMark": "totalMark"})
)
total_df["id"] = "total"
all_stats_df = pd.concat([all_stats_df, total_df])
print(all_stats_df[all_stats_df["id"] == "total"])

fig, ax = plt.subplots(figsize=(12, 6))
# total should be black, thicker line
sns.lineplot(
    data=all_stats_df[all_stats_df["id"] != "total"],
    x="timestamp",
    y="totalMark",
    hue="id",
    marker="o",
    ax=ax,
)

plt.title("transcription progress")
plt.xlabel("Collection time")
plt.ylabel("Total Marked (hours)")
plt.legend(title="User ID", bbox_to_anchor=(1.05, 1), loc="upper left")
plt.tight_layout()
plt.savefig("../figs/transcription_progress.png")

sns.lineplot(
    data=all_stats_df[all_stats_df["id"] == "total"],
    x="timestamp",
    y="totalMark",
    hue="id",
    palette=["black"],
    marker="o",
    linewidth=2.5,
    ax=ax,
)
plt.hlines(y=155.03, xmin=all_stats_df["timestamp"].min(), xmax=all_stats_df["timestamp"].max(), colors='black', linestyles='dashed', label='Corpus total')

plt.savefig("../figs/transcription_progress_with_total.png")
plt.close()