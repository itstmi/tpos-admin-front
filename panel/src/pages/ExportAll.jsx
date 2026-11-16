import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { api, errorText } from '../api';
import { Button, Card } from '../components/ui';

// Emergency backup: every ISP's customers in one text file, ISP wise and alphabetical
const ExportAll = () => {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await api.exportCustomers();
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 max-w-xl space-y-4">
      <div>
        <h3 className="font-bold text-slate-800">Export all customers</h3>
        <p className="text-sm text-slate-500 mt-1">
          All ISPs in one text file: name, user id, phone, package, location and CNIC. Every export is logged and sends an alert.
        </p>
      </div>
      <Button busy={busy} onClick={run}>
        <Download size={16} /> Download
      </Button>
    </Card>
  );
};

export default ExportAll;
