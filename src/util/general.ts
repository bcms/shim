export const General = {
  string: {
    getTextBetween(src: string, begin: string, end: string) {
      const startIndex = src.indexOf(begin);
      if (startIndex === -1) {
        return '';
      }
      const endIndex = src.indexOf(end, startIndex + begin.length);
      if (endIndex === -1) {
        return '';
      }
      return src.substring(startIndex + begin.length, endIndex);
    },
    getAllTextBetween(src: string, begin: string, end: string) {
      const output: string[] = [];
      const index = {
        begin: src.indexOf(begin, 0),
        end: 0,
      };
      if (index.begin === -1) {
        return [];
      }
      index.end = src.indexOf(end, index.begin);
      if (index.end === -1) {
        return [];
      }
      output.push(
        src.substring(index.begin + begin.length, index.end),
      );
      // eslint-disable-next-line no-constant-condition
      while (true) {
        index.begin = src.indexOf(begin, index.end);
        if (index.begin === -1) {
          break;
        }
        index.end = src.indexOf(end, index.begin);
        if (index.end === -1) {
          break;
        }
        output.push(
          src.substring(index.begin + begin.length, index.end),
        );
      }
      return output;
    },
  },
  randomNumber(min: number, max: number) {
    const r = Math.random() * (max - min) + min;
    return Math.floor(r);
  },
};
