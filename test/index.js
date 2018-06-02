const { EventEmitter } = require('events');
const expect = require('expect');

const JSONLengthDelimitedStream = require('../');

const oneByteObject = { eight: 'bit' };
const oneByteBuffer = Buffer.from(JSON.stringify(oneByteObject));

describe('JSONLengthDelimitedStream', function() {
  it('can parse single object from single complete chunk', function() {
    const socket = new EventEmitter();
    const jsonLengthDelimitedStream = new JSONLengthDelimitedStream(socket, { frameLengthInBytes: 1 });
    const singleObjectInFullBuffer = Buffer.from([0xF, ...oneByteBuffer]);

    socket.emit('data', singleObjectInFullBuffer);
    socket.emit('end');

    expect(jsonLengthDelimitedStream.read()).toEqual(oneByteObject);
  });

  it('can parse 2 objects from a single complete chunk', function () {
    const socket = new EventEmitter();
    const jsonLengthDelimitedStream = new JSONLengthDelimitedStream(socket, { frameLengthInBytes: 1 });

    const singleObjectInFullBuffer = Buffer.from([
      0xF,
      ...oneByteBuffer,
      0xF,
      ...oneByteBuffer
    ]);

    socket.emit('data', singleObjectInFullBuffer);
    socket.emit('end');

    expect(jsonLengthDelimitedStream.read()).toEqual(oneByteObject);
    expect(jsonLengthDelimitedStream.read()).toEqual(oneByteObject);
  });

  it('can parse 1 object split across 2 buffers', function() {
    const socket = new EventEmitter();
    const jsonLengthDelimitedStream = new JSONLengthDelimitedStream(socket, { frameLengthInBytes: 1 });

    const firstChunk = Buffer.from([0xF, ...oneByteBuffer.slice(0, 8)]);
    const secondChunk = oneByteBuffer.slice(8);

    socket.emit('data', firstChunk);
    socket.emit('data', secondChunk);
    socket.emit('end');

    expect(jsonLengthDelimitedStream.read(1)).toEqual(oneByteObject);
  });

  it('can parse an object split from its delimiter', function() {
    const socket = new EventEmitter();
    const jsonLengthDelimitedStream = new JSONLengthDelimitedStream(socket, { frameLengthInBytes: 1 });

    socket.emit('data', Buffer.from([0xF]));
    socket.emit('data', oneByteBuffer);
    socket.emit('end');

    expect(jsonLengthDelimitedStream.read(1)).toEqual(oneByteObject);
  });

  it('can parse 2 objects from 2 complete chunks', function () {
    const socket = new EventEmitter();
    const jsonLengthDelimitedStream = new JSONLengthDelimitedStream(socket, { frameLengthInBytes: 1 });

    const singleObjectInFullBuffer = Buffer.from([0xF, ...oneByteBuffer]);
    socket.emit('data', singleObjectInFullBuffer);
    socket.emit('data', singleObjectInFullBuffer);
    socket.emit('end');

    expect(jsonLengthDelimitedStream.read(1)).toEqual(oneByteObject);
    expect(jsonLengthDelimitedStream.read(1)).toEqual(oneByteObject);
  });

  it('can parse an object when the frame delimiter is split between 2 chunks', function () {
    const socket = new EventEmitter();
    const jsonLengthDelimitedStream = new JSONLengthDelimitedStream(socket, { frameLengthInBytes: 4 });

    const firstHalfOfDelimiter = Buffer.from([0x0, 0x0]);
    const secondHalfOfDelimiterAndBody = Buffer.from([0x0, 0xF, ...oneByteBuffer]);

    socket.emit('data', firstHalfOfDelimiter);
    socket.emit('data', secondHalfOfDelimiterAndBody);
    socket.emit('end');

    expect(jsonLengthDelimitedStream.read(1)).toEqual(oneByteObject);
  });
});
