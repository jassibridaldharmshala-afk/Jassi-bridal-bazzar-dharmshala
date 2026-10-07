// Code 39 standard symbol encodings (no customer data or external label service).
const symbols = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*';
const encodings = [20957,29783,23639,30485,20951,29813,23669,20855,29789,23645,29975,23831,30533,22295,30149,24005,21623,29981,23837,22301,30023,23879,30545,22343,30161,24017,21959,30065,23921,22385,29015,18263,29141,17879,29045,18293,17783,29021,18269,17477,17489,17681,20753,35770];
export function rentalBarcode(code) {
  if (!/^[A-Z0-9-]{2,30}$/.test(code || '')) return null;
  const encode = char => encodings[symbols.indexOf(char)].toString(2);
  return encode('*') + [...code].map(char => encode(char) + '0').join('') + encode('*');
}
