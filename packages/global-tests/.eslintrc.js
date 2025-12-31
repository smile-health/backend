module.exports = {
    root: true,
    env: {
        node: true,
        mocha: true,
    },
    extends: 'eslint:recommended',
    parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'commonjs',
    },
    rules: {
        'no-unused-vars': ['warn', { args: 'none' }],
        'no-console': 'off',
        'no-undef': ['error', { typeof: true }], // Ensure typeof is handled for globals
        // Allow require statements for CommonJS modules
        'no-restricted-globals': 'off', // Turn off rule that restricts certain global variables.
    },
    globals: {
        // Explicitly define Mocha globals and CommonJS globals to ensure they are recognized
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        after: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        expect: 'readonly', // Chai expect global
        module: 'readonly', // Allow 'module' global for module.exports
        require: 'readonly', // Allow 'require' global for CommonJS
    },
};
