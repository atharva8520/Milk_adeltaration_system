import os
import mlflow
from mlflow.tracking import MlflowClient

MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)

def load_latest_model(model_name="EngineB_Model", stage="Staging"):
    """
    Polls the MLflow registry to fetch the latest Staging or Production model.
    """
    client = MlflowClient()
    try:
        versions = client.get_latest_versions(name=model_name, stages=[stage])
        if not versions:
            print(f"No {stage} version found for model {model_name}")
            return None
            
        latest_version = versions[0].version
        model_uri = f"models:/{model_name}/{latest_version}"
        print(f"Loading model from {model_uri}")
        return mlflow.sklearn.load_model(model_uri)
    except Exception as e:
        print(f"Error loading model from MLflow: {e}")
        return None
