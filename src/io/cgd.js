const splitLine = (s, lineNr) => {
  const fields = [];
  let inString = false;
  let fieldStart = null;

  for (let i = 0; i < s.length; ++i) {
    const c = s[i];

    if (c == '#')
      break;
    else if (c.match(/\s/)) {
      if (fieldStart != null && !inString) {
        fields.push(s.slice(fieldStart, i));
        fieldStart = null;
      }
    }
    else if (fieldStart == null)
      fieldStart = i;
    else if (!inString && s[fieldStart] == '"')
      throw new Error(`whitespace missing after string at line ${lineNr}`);

    if (c == '"')
      inString = !inString;
  }

  if (inString)
    throw new Error(`closing quotes missing at line ${lineNr}`);
  else if (fieldStart != null)
    fields.push(s.slice(fieldStart));

  return fields;
};


const rawBlocks = function*(lines) {
  let i = 0;
  let current = null;

  for (const line of lines) {
    const lineNr = ++i;
    const fields = splitLine(line, lineNr);
    if (fields.length == 0)
      continue;

    if (fields[0].toLowerCase() == 'end') {
      if (current == null)
        throw new Error(`no active block to be closed at line ${lineNr}`);
      yield current;
      current = null;
    }
    else {
      if (current == null)
        current = [];

      current.push({ lineNr, fields });
    }
  }

  if (current != null)
    throw new Error('file ends within a block');
};


const parseField = s => {
  if (s[0] == '"')
    return s.slice(1, -1);
  else if (s.match(/^[\d+-.]/)) {
    const parts = s.split('/');
    if (parts.length > 2)
      return s;
    else if (parts.length == 2)
      return { n: parseFloat(parts[0]), d: parseFloat(parts[1]) };
    else
      return parseFloat(s);
  }
  else
    return s;
};


const processBlock = block => {
  const content = [];
  let key = null;

  for (let i = 1; i < block.length; ++i) {
    const { lineNr, fields } = block[i];
    const args = fields.map(parseField);

    if (fields[0].match(/^[a-z]/i)) {
      key = fields[0].toLowerCase();
      args.shift();
    }

    if (args.length)
      content.push({ lineNr, key, args });
  }

  return {
    lineNr: block[0].lineNr,
    type  : block[0].fields[0].toLowerCase(),
    content
  };
};


export default function* blocks(lines) {
  for (const b of rawBlocks(lines))
    yield processBlock(b);
};


if (require.main == module) {
  const fs = require('fs');
  let lineNr = 0;

  const test = s => {
    try {
      console.log(splitLine(s, ++lineNr).map(parseField));
    } catch(ex) {
      console.log(ex);
    }
  }

  test('mutus nomen dedit cocis');
  test('mutus nomen "dedit" cocis  ');
  test('   mutus nomen "ded it" cocis 123 # done! ');
  test('  # comment!');
  test('mutus nomen "ded"it cocis');
  test('mutus nomen "dedit cocis');
  test('+1/3 -1.23e3 +15');

  process.argv.slice(2).forEach(file => {
    const txt = fs.readFileSync(file, { encoding: 'utf8' });
    const lines = txt.split(/\r?\n/);
    for (const b of blocks(lines))
      console.log(JSON.stringify(b, null, 2));
  });
}
