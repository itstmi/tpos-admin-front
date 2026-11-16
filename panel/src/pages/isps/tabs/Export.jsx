import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { api, errorText } from '../../../api';
import { Button, Card } from '../../../components/ui';

// One click, one text file of this ISP's customers (name, user id, phone, package, location, CNIC)
const Export = ({ isp, ispId }) => {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await api.exportCustomers(ispId);
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
        <h3 className="font-bold text-slate-800">Export customers</h3>
        <p className="text-sm text-slate-500 mt-1">
          All customers of {isp.business_name} in one text file, alphabetical: name, user id, phone, package, location and CNIC. Every export is logged.
        </p>
      </div>
      <Button busy={busy} onClick={run}>
        <Download size={16} /> Download
      </Button>
    </Card>
  );
};

export default Export;
