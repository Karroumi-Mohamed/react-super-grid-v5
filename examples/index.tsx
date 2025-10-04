/**
 * Examples Index
 *
 * Central place to manage all React Super Grid examples
 */

import AccountingExample from './AccountingExample';

export const examples = {
    accounting: {
        name: 'ERP Accounting Module',
        description: 'Journal entries management with REST API integration',
        component: AccountingExample,
        requiresServer: true,
        serverCommand: 'cd server && npm run dev'
    }
    // Add more examples here as needed
    // basic: {
    //     name: 'Basic Grid',
    //     description: 'Simple grid without plugins',
    //     component: BasicExample,
    //     requiresServer: false
    // }
};

export type ExampleKey = keyof typeof examples;

export { AccountingExample };
