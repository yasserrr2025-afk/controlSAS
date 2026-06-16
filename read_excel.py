import pandas as pd
import sys

try:
  df = pd.read_excel('test/توزيع اللجان.xlsx')
  print('--- توزيع اللجان ---')
  print(df.head(20))
except Exception as e:
  print(e)

try:
  df2 = pd.read_excel('test/كروكي اللجان.xlsx')
  print('\n--- كروكي اللجان ---')
  print(df2.head(20))
except Exception as e:
  print(e)
