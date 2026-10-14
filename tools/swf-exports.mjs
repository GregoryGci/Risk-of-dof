import fs from 'node:fs';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
/** Table ExportAssets d'un SWF FWS/CWS, sans export des données audio/bitmap. */
export function swfExports(file){
  const raw=fs.readFileSync(file),body=raw.toString('ascii',0,3)==='CWS'?zlib.inflateSync(raw.subarray(8)):raw.subarray(8);
  let at=Math.ceil((5+(body[0]>>3)*4)/8)+4;const exports=[];
  while(at+2<=body.length){const header=body.readUInt16LE(at);at+=2;const type=header>>6;let length=header&63;if(length===63){length=body.readUInt32LE(at);at+=4;}const end=at+length;
    if(type===56||type===76){const count=body.readUInt16LE(at);let p=at+2;for(let i=0;i<count;i++){const id=body.readUInt16LE(p);p+=2;const zero=body.indexOf(0,p);exports.push({id,name:body.toString('utf8',p,zero)});p=zero+1;}}
    at=end;if(!type)break;
  }return exports;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(swfExports(process.argv[2]),null,2));
