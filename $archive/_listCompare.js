const compare = async (result1, result2) => {
  const table = [];
  const arr1 = result1.groups.filter(Boolean).sort();
  const arr2 = result2.groups.filter(Boolean).sort();
  const difference1 = arr1.filter((x) => !arr2.includes(x));
  difference1.forEach((element) => {
    table.push({ [result1.sso]: element });
  });

  const intersection = arr1.filter((x) => arr2.includes(x));
  intersection.forEach((element, index) => {
    table[index].shared = element;
  } else {
    table.push({ shared: element });
  });

  const difference2 = arr2.filter((x) => !arr1.includes(x));
  difference2.forEach((element, index) => {
    if (table[index]) {
      table[index][result2.sso] = element;
    } else {
      table.push({ [result2.sso]: element });
    }
  });

  console.table(table);
};

module.exports = {
  compare
};
