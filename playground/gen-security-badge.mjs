function textWidth(text) {
  let width = 0;
  for (const ch of text) {
    if ("iljI.,:;'|! ".includes(ch)) width += 4;
    else if ("mwMW@".includes(ch)) width += 10;
    else if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) width += 7.5;
    else width += 6.2;
  }
  return Math.round(width + 20);
}
const label = 'security', value = 'passed';
const labelWidth = textWidth(label), valueWidth = textWidth(value);
const width = labelWidth + valueWidth;
const center = o => Math.round(o / 2);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="#4c1"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="10" font-weight="bold">
    <text x="${center(labelWidth)}" y="14">${label}</text>
    <text x="${labelWidth + center(valueWidth)}" y="14">${value}</text>
  </g>
</svg>
`;
console.log(svg);
