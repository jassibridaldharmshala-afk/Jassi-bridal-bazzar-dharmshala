import { responsiveImage } from './responsiveImages';
test('display chooses responsive versions while zoom uses the unchanged master', () => {
  const image = { url: 'https://media.example/original.jpg', variants: [320, 640, 1200, 2000].map(width => ({ url: `https://media.example/${width}.webp`, width })) };
  expect(responsiveImage(image).src).toBe('https://media.example/640.webp');
  expect(responsiveImage(image, 'detail').srcSet).toContain('2000.webp 2000w');
  expect(responsiveImage(image, 'thumbnail').srcSet).not.toContain('640.webp');
  expect(responsiveImage(image).srcSet).not.toContain('2000.webp');
  expect(responsiveImage(image, 'thumbnail').sizes).toBe('80px');
  expect(responsiveImage(image, 'zoom')).toEqual({ src: image.url });
  expect(responsiveImage({ url: image.url })).toEqual({ src: image.url });
});
test('a detail profile for a small original is still excluded from product cards', () => {
  const image = { url: 'https://media.example/master.webp', variants: [
    { url: 'https://media.example/card.webp', width: 771, displayWidth: 960 },
    { url: 'https://media.example/detail.webp', width: 941, displayWidth: 1440 },
  ] };
  expect(responsiveImage(image, 'card').srcSet).toBe('https://media.example/card.webp 771w');
  expect(responsiveImage(image, 'detail').srcSet).toContain('detail.webp 941w');
});
