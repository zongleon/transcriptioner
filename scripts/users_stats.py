import pandas as pd

df = pd.read_csv("../assigned_files.csv")

df = df.drop_duplicates(subset=['Name'])[["Name", "id"]]

print(df)