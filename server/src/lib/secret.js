// Chiffrement AES-256-GCM des URL de bases de données stockées dans PlatformDB.
const crypto=require('crypto');
const key=()=>{const s=process.env.TENANT_SECRET||process.env.JWT_SECRET;if(!s)throw new Error('TENANT_SECRET ou JWT_SECRET requis');return crypto.createHash('sha256').update(s).digest()};
function encrypt(txt){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key(),iv),b=Buffer.concat([c.update(txt,'utf8'),c.final()]);return 'enc:'+Buffer.concat([iv,c.getAuthTag(),b]).toString('base64')}
function decrypt(v){if(!v.startsWith('enc:'))return v;const b=Buffer.from(v.slice(4),'base64'),d=crypto.createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8')}
module.exports={encrypt,decrypt};
