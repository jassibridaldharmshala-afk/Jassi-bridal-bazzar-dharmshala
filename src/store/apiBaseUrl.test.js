import { resolveApiBaseUrl } from './apiBaseUrl';

test('explicit local backend ports are respected for isolated environments', () => {
  expect(resolveApiBaseUrl('127.0.0.1', 'http://127.0.0.1:57100/api')).toBe('http://127.0.0.1:57100/api');
  expect(resolveApiBaseUrl('localhost', 'http://localhost:5100')).toBe('http://localhost:5100/api');
});

test('a phone on LAN reaches the development machine, not its own localhost', () => {
  expect(resolveApiBaseUrl('192.168.1.8', 'http://localhost:5100/api')).toBe('http://192.168.1.8:5100/api');
});

test('default local behaviour stays local even with a production deployment URL', () => {
  expect(resolveApiBaseUrl('localhost', 'https://store-api.example/api')).toBe('http://localhost:5000/api');
  expect(resolveApiBaseUrl('127.0.0.1', '')).toBe('http://127.0.0.1:5000/api');
});

test('deployed storefronts retain their configured backend URL and path', () => {
  expect(resolveApiBaseUrl('shop.example', 'https://api.example/store/')).toBe('https://api.example/store/api');
});
