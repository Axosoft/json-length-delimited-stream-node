const bigInt = require('big-integer');
const JSONStream = require('JSONStream');
const { Readable } = require('stream');

module.exports = class JSONLengthDelimitedStream extends Readable {
  constructor(tcpSocket, { frameLengthInBytes = 4 } = {}) {
    super({ objectMode: true });

    const jsonParseStream = JSONStream.parse();

    jsonParseStream.on('data', o => this.push(o));

    let lengthDelimiterAsHexString = '';
    let numBytesNeeded = bigInt();

    const consumeChunkData = (chunk, startingIndex, endingIndex) => {
      jsonParseStream.write(chunk.slice(startingIndex, endingIndex));
      numBytesNeeded = numBytesNeeded.minus(endingIndex - startingIndex);
    };

    tcpSocket.on('data', (buffer) => {
      const chunk = Uint8Array.from(buffer);
      let index = 0;
      while (index < chunk.length) {
        const remainingChunkSize = chunk.length - index;
        const remainingLengthDelimiterSize = frameLengthInBytes - lengthDelimiterAsHexString.length;
        if (numBytesNeeded.gt(remainingChunkSize)) {
          consumeChunkData(chunk, index, index += remainingChunkSize);
        } else if (numBytesNeeded.eq(remainingChunkSize)) {
          consumeChunkData(chunk, index, index += remainingChunkSize);
          lengthDelimiterAsHexString = '';
        } else if (numBytesNeeded.lt(remainingChunkSize) && numBytesNeeded.gt(0)) {
          // it is expected that a chunk is never bigger than (2^16 + 1) and so in this case, we can assume our bigInt
          // will fit into a JS Number
          const bytesToGrab = numBytesNeeded.toJSNumber();
          consumeChunkData(chunk, index, index += bytesToGrab);
          lengthDelimiterAsHexString = '';
          numBytesNeeded = bigInt();
        } else {
          lengthDelimiterAsHexString += Array.from(chunk.slice(index, index += remainingLengthDelimiterSize))
            .map(byte => byte.toString(16))
            .join('');
          if (lengthDelimiterAsHexString.length === frameLengthInBytes) {
            numBytesNeeded = bigInt(lengthDelimiterAsHexString, 16);
          }
        }
      }
    });

    tcpSocket.on('end', () => this.push(null));
  }

  _read() {}
};
