class TokenManager {
    private token: string | null = null;

    setToken(newToken: string) {
        this.token = newToken;
    }

    getToken() {
        if (!this.token) {
            throw new Error('No token set');
        }
        return this.token;
    }

    clearToken() {
        this.token = null;
    }
}

const tokenManager = new TokenManager();

export default tokenManager;
