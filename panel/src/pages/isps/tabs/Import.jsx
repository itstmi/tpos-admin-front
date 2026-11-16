import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FileUp, Upload } from 'lucide-react';
import { api, errorText } from '../../../api';
import { Button, Card, Loaded, inputClass, useLoad } from '../../../components/ui';
import { count } from '../../../format';

const MAX_ROWS = 5000;
const MAX_FILE = 1024 * 1024;

// Same format and limits as the owner panel bulk import: name:username:phone, one per line
function parse(text) {
  const rows = [];
  const bad = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const [name = '', username = '', phone = ''] = line.split(':').map((p) => p.trim());
    const ok = name.length >= 1 && name.length <= 100 && username.length <= 50 && (!phone || /^03[0-9]{9}$/.test(phone));
    if (ok) rows.push({ name, username, phone });
    else bad.push(i + 1);
  });
  return { rows, bad };
}

const Import = ({ ispId, reloadIsp }) => {
  const areas = useLoad(() => api.ispAreas(ispId).then((d) => d.areas), [ispId]);
  const [areaId, setAreaId] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const { rows, bad } = useMemo(() => parse(text), [text]);
  const tooMany = rows.length > MAX_ROWS;

  const readFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE) {
      toast.error('File is larger than 1 MB.');
      return;
    }
    file.text().then(setText).catch(() => toast.error('Could not read the file.'));
  };

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.importCustomers(ispId, areaId, rows);
      setResult({ ...r, withArea: Boolean(areaId) });
      setText('');
      toast.success(`${count(r.imported)} customers imported`);
      reloadIsp();
    } catch (err) {
      const badRows = err.data?.bad_rows;
      toast.error(badRows ? `${count(badRows)} rows are not valid. Nothing was imported.` : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Loaded state={areas}>
      {(list) => (
        <div className="grid lg:grid-cols-2 gap-5">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="font-bold text-slate-800">Import customers</h3>
              <p className="text-sm text-slate-500 mt-1">
                One customer per line as <code className="text-slate-700">name:username:phone</code>. Username and phone can be empty. Up to {count(MAX_ROWS)} lines. New customers come in as inactive with no package.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Area</label>
              <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className={inputClass}>
                <option value="">No area</option>
                {list.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}{a.has_collector ? '' : ' (no collector)'}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-semibold text-slate-600 hover:border-emerald-400 cursor-pointer">
              <FileUp size={18} /> Choose .txt or .csv file
              <input type="file" accept=".txt,.csv,text/plain,text/csv" onChange={readFile} className="hidden" />
            </label>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={'Ali Khan:ali01:03001234567\nBilal::'}
              className={`${inputClass} font-mono text-sm`}
            />

            <div className="text-sm text-slate-600 space-y-1">
              <p>Valid lines: <b>{count(rows.length)}</b></p>
              {bad.length > 0 && (
                <p className="text-red-500">Lines with a problem: {bad.slice(0, 20).join(', ')}{bad.length > 20 ? ` and ${bad.length - 20} more` : ''}</p>
              )}
              {tooMany && <p className="text-red-500">More than {count(MAX_ROWS)} lines.</p>}
            </div>

            <Button busy={busy} disabled={!rows.length || bad.length > 0 || tooMany} onClick={run}>
              <Upload size={16} /> Import
            </Button>
          </Card>

          {result && (
            <Card className="p-6 space-y-3 text-sm">
              <h3 className="font-bold text-slate-800">Result</h3>
              <p>Imported: <b>{count(result.imported)}</b></p>
              <p>Skipped: <b>{count(result.skipped)}</b></p>
              {result.withArea && !result.area_collector && <p className="text-amber-600">This area has no collector.</p>}
              {result.existing_usernames.length > 0 && (
                <p className="text-slate-600">Already in this ISP: {result.existing_usernames.join(', ')}</p>
              )}
              {result.repeated_usernames.length > 0 && (
                <p className="text-slate-600">Repeated in the file: {result.repeated_usernames.join(', ')}</p>
              )}
            </Card>
          )}
        </div>
      )}
    </Loaded>
  );
};

export default Import;
