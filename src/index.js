const bigInt = require('big-integer');
const JSONStream = require('JSONStream');
const { Duplex } = require('stream');

module.exports = class JSONLengthDelimitedStream extends Duplex {
  constructor(tcpSocket, { frameLengthInBytes = 4 } = {}) {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    });

    const jsonParseStream = JSONStream.parse();

    jsonParseStream.on('data', o => this.push(o));

    let lengthDelimiterBytes = [];
    let numBytesNeeded = bigInt();

    const consumeChunkData = (chunk, startingIndex, endingIndex) => {
      jsonParseStream.write(Buffer.from(chunk.slice(startingIndex, endingIndex)));
      numBytesNeeded = numBytesNeeded.minus(endingIndex - startingIndex);
    };

    tcpSocket.on('data', (buffer) => {
      const chunk = Uint8Array.from(buffer);
      let index = 0;
      while (index < chunk.length) {
        const remainingChunkSize = chunk.length - index;
        const remainingLengthDelimiterSize = frameLengthInBytes - lengthDelimiterBytes.length;
        if (numBytesNeeded.gt(remainingChunkSize)) {
          consumeChunkData(chunk, index, index += remainingChunkSize);
        } else if (numBytesNeeded.eq(remainingChunkSize)) {
          consumeChunkData(chunk, index, index += remainingChunkSize);
          lengthDelimiterBytes = [];
        } else if (numBytesNeeded.lt(remainingChunkSize) && numBytesNeeded.gt(0)) {
          // it is expected that a chunk is never bigger than (2^16 + 1) and so in this case, we can assume our bigInt
          // will fit into a JS Number
          const bytesToGrab = numBytesNeeded.toJSNumber();
          consumeChunkData(chunk, index, index += bytesToGrab);
          lengthDelimiterBytes = [];
          numBytesNeeded = bigInt();
        } else {
          lengthDelimiterBytes = [...lengthDelimiterBytes, ...chunk.slice(index, index += remainingLengthDelimiterSize)];
          if (lengthDelimiterBytes.length === frameLengthInBytes) {
            numBytesNeeded = bigInt.fromArray(lengthDelimiterBytes, 256);
          }
        }
      }
    });

    tcpSocket.on('end', () => this.push(null));

    this._write = (object, _, callback) => {
      const throwError = (error) => {
        if (!callback) {
          throw error;
        }
        callback(error);
      };

      if (typeof object !== 'object') {
        throwError(new Error('Writeable must be an object'));
        return;
      }

      const objectAsBuffer = Buffer.from(JSON.stringify(object));
      const sizeInBytes = bigInt(objectAsBuffer.length).toArray(256);

      if (sizeInBytes.length > frameLengthInBytes) {
        throwError('Tried to send an object that was too big for frame');
        return;
      }

      while (sizeInBytes.length < frameLengthInBytes) {
        sizeInBytes.unshift(0);
      }

      return tcpSocket.write(Buffer.from([...sizeInBytes, ...objectAsBuffer]), callback);
    };

    this._read = () => {};
  }
};
