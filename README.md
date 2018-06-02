# JSONLengthDelimitedStream
Wraps a TCP Socket with a length-delimited JSON frame as a readable stream.

## Usage
```javascript
const jsonLengthDelimitedStream = new JSONLengthDelimitedStream(tcpSocket, { frameLengthInBytes: 4 });

jsonLengthDelimitedStream.on('data', (object) => {
  /// do whatever you will with the object!
});

jsonLengthDelimitedStream.on('end', () => {
  // the socket has closed!
});
```
