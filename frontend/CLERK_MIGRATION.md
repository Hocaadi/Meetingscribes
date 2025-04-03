# Clerk Migration Guide

This guide provides instructions for migrating from Clerk's authentication system to our custom authentication system.

## What's Been Done

1. Created a `ClerkAdapter.js` file that provides a compatible implementation of Clerk's hooks and components
2. Created a mock `clerk-react.js` module that can be used as a drop-in replacement for `@clerk/clerk-react`
3. Updated imports in several components to use our `AuthContext` instead of Clerk
4. Created Webpack configuration to alias Clerk imports to our mock implementation

## What Still Needs to Be Done

You're seeing the error `Error: useUser can only be used within the <ClerkProvider /> component` because the application is still trying to use Clerk's `useUser` hook but there's no `ClerkProvider` wrapping the application.

To fix this, follow these steps:

### 1. Wrap Your Application with ClerkProvider

Open your `frontend/src/index.js` file and modify it to include our `ClerkProvider`:

```jsx
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ClerkProvider } from './contexts/ClerkAdapter'; // Import our ClerkProvider

// Apply our adapters and mocks
import './setupAdapters';

ReactDOM.render(
  <React.StrictMode>
    <AuthProvider>
      <ClerkProvider>
        <App />
      </ClerkProvider>
    </AuthProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
```

### 2. Alternative: Use the Module Alias Approach

If you can't easily modify the index.js file (e.g., if you're using a framework like Next.js), you can use the Webpack alias approach:

1. If you're using Create React App, you'll need to eject or use a library like `react-app-rewired`
2. Create a `config-overrides.js` file in your project root:

```js
const path = require('path');

module.exports = function override(config) {
  config.resolve.alias = {
    ...config.resolve.alias,
    '@clerk/clerk-react': path.resolve(__dirname, 'src/mocks/clerk-react.js'),
  };
  
  return config;
};
```

3. Update your package.json to use react-app-rewired:

```json
"scripts": {
  "start": "react-app-rewired start",
  "build": "react-app-rewired build",
  "test": "react-app-rewired test"
}
```

### 3. Replace All Clerk Imports

For both approaches, you should still replace all direct Clerk imports in your components:

```jsx
// Replace this:
import { useUser } from '@clerk/clerk-react';

// With this:
import { useUser } from '../contexts/AuthContext';
```

### Additional Recommendations

1. Consider completely removing the Clerk dependency from your package.json if you're not using it anymore
2. Audit your code for any other Clerk-specific functionality that might need to be replaced

## Testing Your Changes

After making these changes, run your application and check the console for any errors. You should see messages like:

```
ClerkAdapter: ClerkProvider initialized with auth state
```

If you're still seeing Clerk-related errors, check if all components have been updated to use the correct imports.

## Need Help?

If you're still experiencing issues after following these steps, consider the following:

1. Check the browser console for specific error messages
2. Look for any components that might be importing Clerk directly
3. Verify that all the adapter files are being properly loaded 