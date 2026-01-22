module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            ['react-native-worklets-core/plugin'],
            ['module:react-native-dotenv', {
                "moduleName": "@env",
                "path": ".env",
                "safe": false,
                "allowUndefined": true,
                "verbose": false
            }]
        ],
    };
};
