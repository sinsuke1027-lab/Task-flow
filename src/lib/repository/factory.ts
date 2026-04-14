import { DataProvider } from './types';
import { mockProvider } from './mock-provider';

// For now, always return mockProvider. 
// In the future, this will check process.env.DATA_SOURCE or similar.
export function getDataProvider(): DataProvider {
  const dataSource = process.env.DATA_SOURCE || 'mock';
  
  if (dataSource === 'mock') {
    return mockProvider;
  }
  
  // Future implementation for M365 (SharePoint/Graph API)
  // if (dataSource === 'm365') {
  //   return m365Provider;
  // }

  return mockProvider;
}
