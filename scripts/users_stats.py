import pandas as pd

PRINT_USERS = False
JATOS_PROCESS = False
MINUTES = True

DATA_FILE = "../data/jatos_results_data_20250306172600.json"
OUTPUT_NAME = "../stats"

if PRINT_USERS:
    df = pd.read_csv("../assigned_files.csv")

    df = df.drop_duplicates(subset=['Name'])[["Name", "id"]]

    print(df)

# analyze results
# TODO: JATOS API for full automation

if JATOS_PROCESS:
    # first, we need to preprocess the data
    # this happens in place!
    with open(DATA_FILE, "r") as f:
        # replace all instances of "}{" with "}\n{"
        data = f.read().replace("}{", "}\n{").replace("}\n{", "},\n{")

        # rewrite file
        with open(DATA_FILE, "w") as f:
            f.write("[")
            f.write(data)
            f.write("]")

# load data
df = pd.read_json(DATA_FILE)

# filter English (demo)
df = df[df['id'] != 'English']

# Compute session duration for each row, in seconds
df['duration'] = (df['end'] - df['start']) / 1000

if MINUTES:
    df['duration'] = df['duration'] / 60
    df['totalMark'] = df['totalMark'] / 60

# Group by user id and transcription
grouped = df.groupby(['id', 'transcription'])

# 1. Compute total time spent per transcription as the sum of durations.
time_spent = grouped['duration'].sum().reset_index()

# 2. For totalMark and totalChar, select the row with the max "end" (the latest datapoint) for each transcription.
latest = grouped.apply(lambda x: x.loc[x['end'].idxmax()]).reset_index(drop=True)
latest = latest[['id', 'transcription', 'totalMark', 'totalChar']]

# Merge the time spent and latest marking info per transcription.
transcription_stats = pd.merge(time_spent, latest, on=['id', 'transcription'])

# 3. Now, aggregate by user id to get overall stats.
user_stats = transcription_stats.groupby('id').agg({
    'duration': 'sum',
    'totalMark': 'sum',
    'totalChar': 'sum'
}).reset_index()

# Rename columns if needed
user_stats.rename(columns={'duration': 'totalTimeSpent'}, inplace=True)

print("Per transcription stats:")
print(transcription_stats)
print("\nAggregated per user stats:")
print(user_stats)

# save to file
transcription_stats.to_csv(OUTPUT_NAME + "_by_ts.csv", index=False)
user_stats.to_csv(OUTPUT_NAME + "_by_usr.csv", index=False)