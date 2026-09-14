import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const ACCESS_CODE = "jmcss2026";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("app_authenticated") === "true"
  );
  const [inputCode, setInputCode] = useState("");
  const [error, setError] = useState(false);

  // App Main State
  const [employees, setEmployees] = useState([]);
  const [stipendTypes, setStipendTypes] = useState([]);
  
    // Entry Form State (Modified for Multiple Entries)
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [stipendRows, setStipendRows] = useState([
    { stipendTypeId: '', quantity: 1, customRate: '' }
  ]);

  
  // Records & Data State
  const [stipendsList, setStipendsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reporting / Filter State
  const [reportStaffId, setReportStaffId] = useState('ALL');
  const [reportStipendTypeId, setReportStipendTypeId] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  async function fetchData() {
    setLoading(true);
    const { data: empData, error: empErr } = await supabase.from('Employee').select('*');
    const { data: typeData } = await supabase.from('stipend_types').select('*');
    const { data: stipendData } = await supabase
      .from('employee_stipends')
      .select('*, Employee("First Name", "Last Name"), stipend_types(*)');

    if (empErr) console.error('Employee Fetch Error:', empErr);
    if (empData) setEmployees(empData);
    if (typeData) setStipendTypes(typeData);
    if (stipendData) setStipendsList(stipendData);
    setLoading(false);
  }

  const handleLogin = (e) => {
    e.preventDefault();
    if (inputCode === ACCESS_CODE) {
      localStorage.setItem("app_authenticated", "true");
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

    const handleRowChange = (index, field, value) => {
    const updatedRows = [...stipendRows];
    updatedRows[index][field] = value;
    setStipendRows(updatedRows);
  };

  const addStipendRow = () => {
    setStipendRows([...stipendRows, { stipendTypeId: '', quantity: 1, customRate: '' }]);
  };

  const removeStipendRow = (index) => {
    if (stipendRows.length === 1) return; // Keep at least one row
    const updatedRows = stipendRows.filter((_, i) => i !== index);
    setStipendRows(updatedRows);
  };

       async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedStaffId || !effectiveDate) return;

    // Filter out rows that don't have a stipend type selected
    const validRows = stipendRows.filter(row => row.stipendTypeId !== '');
    if (validRows.length === 0) {
      alert("Please select at least one stipend type.");
      return;
    }

    // Format rows for bulk Supabase insertion with explicit default rates
    const insertData = validRows.map(row => {
      // Find the selected stipend type object to look up its default rate
      const selectedType = stipendTypes.find(t => String(t.id) === String(row.stipendTypeId));
      // Align with your exact database column: default_rate
      const defaultRate = selectedType?.default_rate || 18;

      return {
        staff_id: selectedStaffId,
        stipend_type_id: row.stipendTypeId,
        quantity: parseInt(row.quantity) || 1,
        // If customRate is blank, explicitly inject the default rate instead of sending null
        custom_rate: row.customRate !== '' ? parseFloat(row.customRate) : defaultRate,
        effective_date: effectiveDate
      };
    });

    const { error } = await supabase.from('employee_stipends').insert(insertData);

    if (!error) {
      // Reset form to defaults
      setStipendRows([{ stipendTypeId: '', quantity: 1, customRate: '' }]);
      setEffectiveDate('');
      fetchData();
    } else {
      alert(error.message);
    }
  }

    function getEffectiveRate(item) {
    if (item.custom_rate !== null && item.custom_rate !== undefined && item.custom_rate !== '') {
      return parseFloat(item.custom_rate);
    }
    // Align with your exact database column: default_rate
    return item.stipend_types?.default_rate || 18;
  }

  // Gate Check for Password Access Code
  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <form onSubmit={handleLogin} style={{ padding: '2rem', border: '1px solid #ccc', borderRadius: '8px', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <h2>JMCSS Stipend Tracker</h2>
          <p style={{ color: '#555' }}>Please enter the access code to proceed:</p>
          <input 
            type="password" 
            value={inputCode} 
            onChange={(e) => setInputCode(e.target.value)} 
            placeholder="Enter access code"
            style={{ padding: '8px', fontSize: '16px', marginBottom: '10px', width: '80%', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <br />
          <button type="submit" style={{ padding: '8px 16px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px' }}>Enter</button>
          {error && <p style={{ color: 'red', marginTop: '10px' }}>Incorrect access code.</p>}
        </form>
      </div>
    );
  }

  if (loading) return <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Loading database...</div>;

  const filteredStipends = stipendsList.filter((item) => {
    if (reportStaffId !== 'ALL' && String(item.staff_id) !== String(reportStaffId)) return false;
    if (reportStipendTypeId !== 'ALL' && String(item.stipend_type_id) !== String(reportStipendTypeId)) return false;
    if (startDate && item.effective_date && item.effective_date < startDate) return false;
    if (endDate && item.effective_date && item.effective_date > endDate) return false;
    return true;
  });

  const totalEntries = filteredStipends.length;
  const totalStipendQuantity = filteredStipends.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalDollarAmount = filteredStipends.reduce((sum, item) => {
    const rate = getEffectiveRate(item);
    const qty = item.quantity || 0;
    return sum + (qty * rate);
  }, 0);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Employee Stipend Tracker</h1>

            {/* Entry Form */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <h2 style={{ marginTop: 0 }}>Log Stipends for Employee</h2>
        <form onSubmit={handleSubmit}>
          
          {/* Employee & Date Selector Row */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Employee Name:</label>
              <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} required style={{ padding: '0.5rem', minWidth: '250px' }}>
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp['Staff ID']} value={emp['Staff ID']}>
                    {emp['First Name']} {emp['Last Name']} ({emp['Staff ID']})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Effective Date:</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
                style={{ padding: '0.45rem' }}
              />
            </div>
          </div>

          {/* Dynamic Stipend Sub-Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Assign Stipends:</label>
            
            {stipendRows.map((row, index) => (
              <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <select 
                    value={row.stipendTypeId} 
                    onChange={(e) => handleRowChange(index, 'stipendTypeId', e.target.value)} 
                    required 
                    style={{ padding: '0.5rem', width: '100%' }}
                  >
                    <option value="">Select Stipend Type</option>
                    {stipendTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={row.quantity}
                    onChange={(e) => handleRowChange(index, 'quantity', e.target.value)}
                    required
                    style={{ padding: '0.45rem', width: '60px' }}
                  />
                </div>

                <div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Custom Rate ($)"
                    value={row.customRate}
                    onChange={(e) => handleRowChange(index, 'customRate', e.target.value)}
                    style={{ padding: '0.45rem', width: '120px' }}
                  />
                </div>

                {stipendRows.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeStipendRow(index)} 
                    style={{ padding: '0.45rem 0.75rem', cursor: 'pointer', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Form Action Controls */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              type="button" 
              onClick={addStipendRow} 
              style={{ padding: '0.55rem 1rem', cursor: 'pointer', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px' }}
            >
              + Add Another Stipend
            </button>
            
            <button 
              type="submit" 
              style={{ padding: '0.55rem 1rem', cursor: 'pointer', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', marginLeft: 'auto' }}
            >
              Save All Stipends
            </button>
          </div>
        </form>
      </div>


      {/* Report Controls & Summaries */}
      <div style={{ backgroundColor: '#eef2f5', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <h2 style={{ marginTop: 0 }}>Stipend Reports & Filters</h2>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Filter by Employee:</label>
            <select value={reportStaffId} onChange={(e) => setReportStaffId(e.target.value)} style={{ padding: '0.5rem' }}>
              <option value="ALL">All Employees</option>
              {employees.map((emp) => (
                <option key={emp['Staff ID']} value={emp['Staff ID']}>
                  {emp['First Name']} {emp['Last Name']} ({emp['Staff ID']})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Filter by Stipend Type:</label>
            <select value={reportStipendTypeId} onChange={(e) => setReportStipendTypeId(e.target.value)} style={{ padding: '0.5rem' }}>
              <option value="ALL">All Stipend Types</option>
              {stipendTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Start Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '0.45rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>End Date:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '0.45rem' }}
            />
          </div>

          <button
            onClick={() => { setReportStaffId('ALL'); setReportStipendTypeId('ALL'); setStartDate(''); setEndDate(''); }}
            style={{ padding: '0.55rem 1rem', cursor: 'pointer', backgroundColor: '#666', color: '#fff', border: 'none', borderRadius: '4px' }}
          >
            Clear Filters
          </button>
        </div>

        {/* Aggregate Summary Cards */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ backgroundColor: '#fff', padding: '1rem 1.5rem', borderRadius: '6px', border: '1px solid #ccc', minWidth: '150px' }}>
            <span style={{ fontSize: '0.85rem', color: '#555' }}>Total Logged Entries</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>{totalEntries}</div>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '1rem 1.5rem', borderRadius: '6px', border: '1px solid #ccc', minWidth: '150px' }}>
            <span style={{ fontSize: '0.85rem', color: '#555' }}>Total Stipend Count (Qty)</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px', color: '#0070f3' }}>{totalStipendQuantity}</div>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '1rem 1.5rem', borderRadius: '6px', border: '1px solid #ccc', minWidth: '150px' }}>
            <span style={{ fontSize: '0.85rem', color: '#555' }}>Total Payout Amount</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px', color: '#2e7d32' }}>
              ${totalDollarAmount.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Stipend Records Table */}
      <h2>Report Details ({filteredStipends.length} Records)</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', backgroundColor: '#fafafa' }}>
            <th style={{ padding: '0.75rem' }}>Effective Date</th>
            <th style={{ padding: '0.75rem' }}>Staff ID</th>
            <th style={{ padding: '0.75rem' }}>Employee</th>
            <th style={{ padding: '0.75rem' }}>Stipend Type</th>
            <th style={{ padding: '0.75rem' }}>Qty</th>
            <th style={{ padding: '0.75rem' }}>Rate</th>
            <th style={{ padding: '0.75rem' }}>Total Amount</th>
          </tr>
        </thead>
        <tbody>
          {filteredStipends.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ padding: '1rem', textAlign: 'center', color: '#777' }}>
                No records match the selected report criteria.
              </td>
            </tr>
          ) : (
            filteredStipends.map((item) => {
              const rate = getEffectiveRate(item);
              const lineTotal = (item.quantity || 0) * rate;
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>{item.effective_date || 'N/A'}</td>
                  <td style={{ padding: '0.75rem' }}>{item.staff_id}</td>
                  <td style={{ padding: '0.75rem' }}>
                    {item.Employee?.['First Name']} {item.Employee?.['Last Name']}
                  </td>
                  <td style={{ padding: '0.75rem' }}>{item.stipend_types?.name}</td>
                  <td style={{ padding: '0.75rem' }}>{item.quantity}</td>
                  <td style={{ padding: '0.75rem' }}>${rate.toFixed(2)}</td>
                  <td style={{ padding: '0.75rem', fontWeight: '500' }}>${lineTotal.toFixed(2)}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  );
}