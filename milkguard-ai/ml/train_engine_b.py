import pandas as pd
import numpy as np
import xgboost as xgb
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from sklearn.ensemble import RandomForestClassifier
import joblib
import json
import mlflow
from mlflow.models import infer_signature
from features.extract import load_and_clean_data, get_features_and_target
from mlflow.tracking.client import MlflowClient

# Configure MLflow pointing to local docker-compose service
mlflow.set_tracking_uri("http://mlflow:5000")
mlflow.set_experiment("Engine_B_Adulteration")

def train():
    df = load_and_clean_data("data/Sample/milk_adulteration_dataset.csv")
    X, y = get_features_and_target(df, target_col='Adulterated')
    
    # Calculate scale_pos_weight for imbalance (~5% positive)
    neg_count = (y == 0).sum()
    pos_count = (y == 1).sum()
    spw = neg_count / pos_count
    
    # Stratified split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    
    models = {
        "XGBoost": xgb.XGBClassifier(scale_pos_weight=spw, random_state=42, eval_metric='logloss'),
        "LightGBM": lgb.LGBMClassifier(scale_pos_weight=spw, random_state=42, verbose=-1),
        "RandomForest": RandomForestClassifier(class_weight='balanced', random_state=42)
    }
    
    best_f1 = -1
    best_recall = -1
    best_run_id = None
    best_model_name = None
    
    results = []
    
    for name, model in models.items():
        with mlflow.start_run(run_name=name) as run:
            model.fit(X_train, y_train)
            preds = model.predict(X_test)
            proba = model.predict_proba(X_test)[:, 1]
            
            precision = float(precision_score(y_test, preds))
            recall = float(recall_score(y_test, preds))
            f1 = float(f1_score(y_test, preds))
            roc_auc = float(roc_auc_score(y_test, proba))
            
            mlflow.log_param("model_type", name)
            mlflow.log_param("scale_pos_weight", spw)
            mlflow.log_metric("Precision", precision)
            mlflow.log_metric("Recall", recall)
            mlflow.log_metric("F1-Score", f1)
            mlflow.log_metric("ROC-AUC", roc_auc)
            
            signature = infer_signature(X_train, preds)
            
            # Log the model
            if name == "XGBoost":
                mlflow.xgboost.log_model(model, "model", signature=signature)
            elif name == "LightGBM":
                mlflow.lightgbm.log_model(model, "model", signature=signature)
            else:
                mlflow.sklearn.log_model(model, "model", signature=signature)
            
            results.append({
                "Model": name,
                "Precision": precision,
                "Recall": recall,
                "F1": f1,
                "ROC-AUC": roc_auc
            })
            
            print(f"[{name}] F1: {f1:.4f} | Recall: {recall:.4f} | ROC-AUC: {roc_auc:.4f}")
            
            if f1 > best_f1 or (f1 == best_f1 and recall > best_recall):
                best_f1 = f1
                best_recall = recall
                best_run_id = run.info.run_id
                best_model_name = name

    print("\n--- Model Comparison ---")
    results_df = pd.DataFrame(results)
    print(results_df.to_markdown(index=False))

    print(f"\nBest Model Promoted: {best_model_name} with F1-Score: {best_f1:.4f}")
    
    # Register the best model
    model_uri = f"runs:/{best_run_id}/model"
    registered_model_name = "EngineB_Model"
    print(f"Registering model {model_uri} as {registered_model_name}...")
    
    mv = mlflow.register_model(model_uri, registered_model_name)
    
    # Transition to Staging
    client = MlflowClient()
    client.transition_model_version_stage(
        name=registered_model_name,
        version=mv.version,
        stage="Staging"
    )
    print(f"Model version {mv.version} promoted to Staging.")

if __name__ == "__main__":
    train()
