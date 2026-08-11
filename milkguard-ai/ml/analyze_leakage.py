import pandas as pd
from sklearn.feature_selection import mutual_info_classif
from scipy.stats import pointbiserialr
import json

df = pd.read_csv("../../data/important_features.csv")

target = 'Is_Adulterated'
features = ['FSSAI_Chemical_Score', 'Quality_Score_0_100']

# Point-biserial correlation
corr_fssai, p_fssai = pointbiserialr(df[target], df['FSSAI_Chemical_Score'])
corr_quality, p_quality = pointbiserialr(df[target], df['Quality_Score_0_100'])

# Mutual Information
mi = mutual_info_classif(df[features], df[target], random_state=42)

results = {
    "FSSAI_Chemical_Score": {
        "correlation": corr_fssai,
        "mutual_info": mi[0]
    },
    "Quality_Score_0_100": {
        "correlation": corr_quality,
        "mutual_info": mi[1]
    }
}

print(json.dumps(results, indent=2))
