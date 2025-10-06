interface Env {
    DATA_DB: D1Database;
    API_KEY_HASH: {
        get(): Promise<string>;
    };
}