from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "birdscope"
    db_user: str = "postgres"
    db_password: str = ""

    geoserver_url: str = "http://localhost:8080/geoserver"
    geoserver_user: str = "admin"
    geoserver_password: str = "geoserver"
    geoserver_workspace: str = "birdscope"
    geoserver_datastore: str = "birdscope_pg"

    raw_data_path: str = "D:/EBIRD/0009321-260519110011954.csv"

    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug: bool = True

    @property
    def db_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()
