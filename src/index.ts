import './tailwind.css';
import App from './app';
import tokenManager from './context/export-image-context/tokenManager';

export { App };

export default App;

export const setAuthToken = (token: string) => {
    tokenManager.setToken(token);
};