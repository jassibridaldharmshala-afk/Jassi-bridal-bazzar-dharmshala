export function buildDraftPhotoGroups(files, groups) {
  if (!groups.length) throw new Error('Select photos and create a product group first.');
  const assigned = new Set();
  const result = groups.map((group) => {
    if (!group.photos.length) throw new Error('Each product group needs at least one photo.');
    const photoIndexes = group.photos.map((photo) => {
      const index = files.indexOf(photo);
      if (index < 0) throw new Error('A grouped photo was removed. Please review your groups.');
      if (assigned.has(index)) throw new Error('Each photo can belong to only one product.');
      assigned.add(index);
      return index;
    });
    const coverIndex = files.indexOf(group.cover || group.photos[0]);
    if (!photoIndexes.includes(coverIndex)) throw new Error('Choose a cover from the same product group.');
    return { name: String(group.name || '').trim(), photoIndexes, coverIndex };
  });
  if (assigned.size !== files.length) throw new Error('Assign every photo to a product group or remove the unused photos.');
  return result;
}
