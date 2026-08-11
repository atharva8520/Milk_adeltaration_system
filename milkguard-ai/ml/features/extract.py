import pandas as pd
import numpy as np

def load_and_clean_data(data_path: str) -> pd.DataFrame:
    """
    Loads raw sample data and cleans it by removing data leakage columns.
    """
    df = pd.read_csv(data_path)
    
    # Drop leakage and secondary targets
    drop_cols = ['Adulteration_Index', 'FSSAI_Chemical_Score', 'Quality_Score_0_100']
    
    # Only drop if they exist in the dataframe to make the function robust
    cols_to_drop = [col for col in drop_cols if col in df.columns]
    
    if cols_to_drop:
        df = df.drop(columns=cols_to_drop)
        
    return df

def get_features_and_target(df: pd.DataFrame, target_col: str = 'Adulterated'):
    """
    Splits dataframe into features and target.
    """
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in the dataset.")
        
    X = df.drop(columns=[target_col])
    y = df[target_col]
    return X, y
