import { readFileSync } from 'fs';
import { join } from 'path';

export default function Page() {
  const htmlPath = join(process.cwd(), 'public', 'semble.html');
  const html = readFileSync(htmlPath, 'utf-8');

  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  );
}
