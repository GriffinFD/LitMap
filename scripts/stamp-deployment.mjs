import {writeFileSync} from 'node:fs';
const commit = process.env.GITHUB_SHA;
if (!/^[a-f0-9]{40}$/.test(commit ?? '')) throw new Error('A full GITHUB_SHA is required');
writeFileSync(new URL('../dist/deployment.json', import.meta.url), JSON.stringify({commit})+'\n');
