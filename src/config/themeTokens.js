const rgb = hex => /^#[0-9a-f]{6}$/i.test(hex || '')
  ? [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)) : [109, 31, 52];
export const rgbChannels = hex => rgb(hex).join(' ');
export function onColor(hex) {
  const luminance = rgb(hex).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  return luminance > .179 ? '#17161a' : '#ffffff';
}
export function brandShades(hex) {
  const base = rgb(hex);
  return [.94, .85, .7, .55, .35, .15, 0, -.12, -.24, -.36].map(amount => `#${base.map(value =>
    Math.round(amount >= 0 ? value + (255 - value) * amount : value * (1 + amount)).toString(16).padStart(2, '0')).join('')}`);
}
