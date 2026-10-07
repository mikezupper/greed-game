export const POINTS = { one: 100, five: 50, tripleOne: 1000, four: 1000, fiveKind: 2000, six: 3000, straightOrPairs: 1500, twoTriplets: 2500 } as const;
const format = (n: number) => n.toLocaleString('en-US');
export const SCORING_ROWS = [
  ['Single 1 / single 5', `${POINTS.one} / ${POINTS.five}`], ['Three 1s', format(POINTS.tripleOne)], ['Three 2s–6s', `Face value × ${POINTS.one}`],
  ['Four / five / six of a kind', [POINTS.four, POINTS.fiveKind, POINTS.six].map(format).join(' / ')], ['Straight / three distinct pairs', format(POINTS.straightOrPairs)], ['Two distinct triplets', format(POINTS.twoTriplets)],
] as const;
