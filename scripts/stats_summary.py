# read all the generated stats files and plot line chart
# of each user's transcription progress (totalMark) for each
# timestamp
import glob
import pandas as pd
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