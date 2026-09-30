import { useEffect, useState } from 'react';

const ACCESS_CODE = "jmcss2026";
const API_BASE_URL = "http://localhost:5000/api";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("app_authenticated") === "true"
  );
  const [inputCode, setInputCode] = useState("");
  const [error, setError] = useState(false);

  // App Main State
  const [employees, setEmployees] = useState([]);
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [stipendTypes, setStipendTypes] = useState([]);
  
  // Entry Form State (Configured for Multiple Dynamic Rows)
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [stipendRows, setStipendRows] = useState([
    { stipendTypeId: '', quantity: 1, customRate: '' }
  ]);
  
  // Staff Modal / Form State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    staffId: '',
    firstName: '',
    lastName: '',
    position: 'Driver',
    active: 'Yes'
  });

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

    try {
      // Fetch all required data in parallel from local Express backend
      const [empRes, typeRes, stipendRes] = await Promise.all([
        fetch(`${API_BASE_URL}/employees`),
        fetch(`${API_BASE_URL}/stipend-types`),
        fetch(`${API_BASE_URL}/employee-stipends`)
      ]);

      const empData = await empRes.json();
      const typeData = await typeRes.json();
      const stipendData = await stipendRes.json();

      if (empData) {
        // Sort array alphabetically by 'Last Name' (A-Z)
        const sortedEmployees = [...empData].sort((a, b) => {
          const lastNameA = (a['Last Name'] || a['lastName'] || '').toLowerCase();
          const lastNameB = (b['Last Name'] || b['lastName'] || '').toLowerCase();
          return lastNameA.localeCompare(lastNameB);
        });

        // Populate all staff sorted for the lower reporting filter
        setEmployees(sortedEmployees);

        // Filter active Drivers from the sorted list
        const activeDrivers = sortedEmployees.filter((emp) => {
          const activeVal = emp['Active'] || emp['active'];
          const posVal = emp['Position'] || emp['position'];
          const isActive = activeVal && String(activeVal).trim().toLowerCase() === 'yes';
          const isDriver = posVal && String(posVal).trim() === 'Driver';
          return isActive && isDriver;
        });

        setActiveEmployees(activeDrivers);
      }

      if (typeData) setStipendTypes(typeData);
      if (stipendData) setStipendsList(stipendData);
    } catch (err) {
      console.error('Local Database Fetch Error:', err);
    } finally {
      setLoading(false);
    }
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

  // Helper function to manage dynamic row modifications immutably
  const handleRowChange = (index, field, value) => {
    const updatedRows = [...stipendRows];
    updatedRows[index] = { 
      ...updatedRows[index], 
      [field]: value 
    };
    setStipendRows(updatedRows);
  };

  const addStipendRow = () => {
    setStipendRows([...stipendRows, { stipendTypeId: '', quantity: 1, customRate: '' }]);
  };

  const removeStipendRow = (index) => {
    if (stipendRows.length === 1) return; // Keep at least one row active
    const updatedRows = stipendRows.filter((_, i) => i !== index);
    setStipendRows(updatedRows);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedStaffId || !effectiveDate) return;

    // Filter out rows that do not have a stipend type selected
    const validRows = stipendRows.filter(row => row.stipendTypeId !== '');
    if (validRows.length === 0) {
      alert("Please select at least one stipend type.");
      return;
    }

    // Format rows for bulk local database insertion
    const insertData = validRows.map(row => {
      const selectedType = stipendTypes.find(t => String(t.id) === String(row.stipendTypeId));
      const defaultRate = selectedType?.default_rate || 18;

      return {
        staff_id: selectedStaffId,
        stipend_type_id: parseInt(row.stipendTypeId) || row.stipendTypeId,
        quantity: parseInt(row.quantity) || 1,
        custom_rate: row.customRate !== '' && row.customRate !== null && row.customRate !== undefined
          ? parseFloat(row.customRate) 
          : parseFloat(defaultRate),
        effective_date: effectiveDate
      };
    });

    try {
      const res = await fetch(`${API_BASE_URL}/employee-stipends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insertData)
      });

      if (res.ok) {
        setStipendRows([{ stipendTypeId: '', quantity: 1, customRate: '' }]);
        setEffectiveDate('');
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to save stipends.');
      }
    } catch (err) {
      alert('Failed to connect to local database server. Ensure start-app.bat is running.');
    }
  }

  // Delete an individual stipend entry with double-verification
async function handleDeleteStipend(item) {
  const rate = getEffectiveRate(item);
  const qty = item.quantity || 0;
  const expectedTotal = (qty * rate).toFixed(2);

  // First check: Basic confirmation
  const initialConfirm = window.confirm(
    `Are you sure you want to delete this stipend for Staff ID ${item.staff_id}?`
  );
  if (!initialConfirm) return;

  // Second check: Security challenge (Requires entering exact total amount)
  const userInput = window.prompt(
    `SECURITY CHECK: To confirm deletion, please enter the EXACT total dollar amount of this record ($${expectedTotal}):`
  );

  // If user clicks Cancel or enters the wrong amount
  if (userInput === null) return; // User canceled
  
  if (parseFloat(userInput).toFixed(2) !== expectedTotal) {
    alert(`Verification failed! You entered "$${userInput}", but the expected amount was "$${expectedTotal}". Record was NOT deleted.`);
    return;
  }

  // Verification passed — Proceed with API call
  try {
    const res = await fetch(`${API_BASE_URL}/employee-stipends/${item.id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      fetchData();
    } else {
      const errData = await res.json();
      alert(errData.error || 'Failed to delete record.');
    }
  } catch (err) {
    alert('Failed to delete stipend record from local database.');
  }
}

  // Submit new staff member to database
  async function handleAddStaffSubmit(e) {
    e.preventDefault();
    if (!newStaff.staffId || !newStaff.firstName || !newStaff.lastName) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff)
      });

      if (res.ok) {
        setNewStaff({ staffId: '', firstName: '', lastName: '', position: 'Driver', active: 'Yes' });
        setIsStaffModalOpen(false);
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to add staff member.');
      }
    } catch (err) {
      alert('Failed to connect to local database server.');
    }
  }

  function getEffectiveRate(item) {
    if (item.custom_rate !== null && item.custom_rate !== undefined && item.custom_rate !== '') {
      return parseFloat(item.custom_rate);
    }
    return item.stipend_types?.default_rate || 18;
  }

  // Gate Check for Password Access Code
  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#0a192f' }}>
        <form onSubmit={handleLogin} style={{ padding: '2rem', border: '1px solid #233554', borderRadius: '8px', textAlign: 'center', maxWidth: '400px', width: '100%', backgroundColor: '#112240', color: '#e6f1ff' }}>
          <h2 style={{ color: '#ffffff' }}>JMCSS Stipend Tracker</h2>
          <p style={{ color: '#8892b0' }}>Please enter the access code to proceed:</p>
          <input 
            type="password" 
            value={inputCode} 
            onChange={(e) => setInputCode(e.target.value)} 
            placeholder="Enter access code"
            style={{ padding: '8px', fontSize: '16px', marginBottom: '10px', width: '80%', borderRadius: '4px', border: '1px solid #233554', backgroundColor: '#0a192f', color: '#ffffff' }}
          />
          <br />
          <button type="submit" style={{ padding: '8px 16px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px' }}>Enter</button>
          {error && <p style={{ color: '#ff6b6b', marginTop: '10px' }}>Incorrect access code.</p>}
        </form>
      </div>
    );
  }

  if (loading) return <div style={{ padding: '2rem', fontFamily: 'sans-serif', backgroundColor: '#0a192f', color: '#e6f1ff', minHeight: '100vh' }}>Loading local database...</div>;

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
    <div style={{ backgroundColor: '#0a192f', color: '#e6f1ff', minHeight: '100vh', padding: '2rem 1rem', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ color: '#ffffff', margin: 0 }}>Employee Stipend Tracker</h1>
          <button
            type="button"
            className="no-print"
            onClick={() => setIsStaffModalOpen(true)}
            style={{ padding: '0.6rem 1.2rem', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Add New Staff
          </button>
        </div>

        {/* Modal Window for Adding Staff */}
        {isStaffModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#112240', padding: '2rem', borderRadius: '8px', border: '1px solid #233554', maxWidth: '450px', width: '90%', color: '#e6f1ff' }}>
              <h2 style={{ marginTop: 0, color: '#ffffff' }}>Add New Staff Member</h2>
              <form onSubmit={handleAddStaffSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px', color: '#8892b0' }}>Staff ID / Employee #:</label>
                  <input
                    type="text"
                    required
                    value={newStaff.staffId}
                    onChange={(e) => setNewStaff({ ...newStaff, staffId: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0a192f', color: '#fff', border: '1px solid #233554', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px', color: '#8892b0' }}>First Name:</label>
                  <input
                    type="text"
                    required
                    value={newStaff.firstName}
                    onChange={(e) => setNewStaff({ ...newStaff, firstName: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0a192f', color: '#fff', border: '1px solid #233554', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px', color: '#8892b0' }}>Last Name:</label>
                  <input
                    type="text"
                    required
                    value={newStaff.lastName}
                    onChange={(e) => setNewStaff({ ...newStaff, lastName: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0a192f', color: '#fff', border: '1px solid #233554', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px', color: '#8892b0' }}>Position:</label>
                  <select
                    value={newStaff.position}
                    onChange={(e) => setNewStaff({ ...newStaff, position: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0a192f', color: '#fff', border: '1px solid #233554', borderRadius: '4px', boxSizing: 'border-box' }}
                  >
                    <option value="Driver">Driver</option>
                    <option value="Monitor">Monitor</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px', color: '#8892b0' }}>Active Status:</label>
                  <select
                    value={newStaff.active}
                    onChange={(e) => setNewStaff({ ...newStaff, active: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0a192f', color: '#fff', border: '1px solid #233554', borderRadius: '4px', boxSizing: 'border-box' }}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsStaffModalOpen(false)}
                    style={{ padding: '0.5rem 1rem', backgroundColor: '#233554', color: '#8892b0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '0.5rem 1rem', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Save Staff Member
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Entry Form */}
        <div className="no-print" style={{ backgroundColor: '#112240', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #233554' }}>
          <h2 style={{ marginTop: 0, color: '#ffffff' }}>Log Stipends for Employee</h2>
          <form onSubmit={handleSubmit}>
            
            {/* Employee & Date Selector Row */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#8892b0' }}>Employee Name:</label>
                <select 
                  value={selectedStaffId} 
                  onChange={(e) => setSelectedStaffId(e.target.value)} 
                  required 
                  style={{ padding: '0.5rem', minWidth: '250px', backgroundColor: '#0a192f', color: '#ffffff', border: '1px solid #233554', borderRadius: '4px' }}
                >
                  <option value="">Select Employee</option>
                  {activeEmployees.map((emp) => {
                    const id = emp['Staff ID'] || emp['staffId'];
                    const firstName = emp['First Name'] || emp['firstName'];
                    const lastName = emp['Last Name'] || emp['lastName'];
                    return (
                      <option key={id} value={id}>
                        {firstName} {lastName} ({id})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#8892b0' }}>Effective Date:</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  required
                  style={{ padding: '0.45rem', backgroundColor: '#0a192f', color: '#ffffff', border: '1px solid #233554', borderRadius: '4px' }}
                />
              </div>
            </div>

            {/* Dynamic Stipend Sub-Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#8892b0' }}>Assign Stipends:</label>
              
              {stipendRows.map((row, index) => (
                <div key={`${index}-${row.stipendTypeId}`} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  
                  <div style={{ flex: '1', minWidth: '200px' }}>
                    <select 
                      value={row.stipendTypeId} 
                      onChange={(e) => handleRowChange(index, 'stipendTypeId', e.target.value)} 
                      required 
                      style={{ padding: '0.5rem', width: '100%', backgroundColor: '#0a192f', color: '#ffffff', border: '1px solid #233554', borderRadius: '4px' }}
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
                      style={{ padding: '0.45rem', width: '60px', backgroundColor: '#0a192f', color: '#ffffff', border: '1px solid #233554', borderRadius: '4px' }}
                    />
                  </div>

                  <div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={
                        row.stipendTypeId 
                          ? `Default: $${stipendTypes.find(t => t.id == row.stipendTypeId)?.default_rate || '18'}`
                          : "Default: $18"
                      }
                      value={row.customRate}
                      onChange={(e) => handleRowChange(index, 'customRate', e.target.value)}
                      style={{ padding: '0.45rem', width: '120px', backgroundColor: '#0a192f', color: '#ffffff', border: '1px solid #233554', borderRadius: '4px' }}
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
                style={{ padding: '0.55rem 1rem', cursor: 'pointer', backgroundColor: '#233554', color: '#8892b0', border: '1px solid #233554', borderRadius: '4px' }}
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

        {/* Reporting Summary Cards */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ border: '1px solid #233554', padding: '1rem', borderRadius: '8px', flex: 1, backgroundColor: '#1d2d50' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#8892b0' }}>Total Entries</h3>
            <p style={{ fontSize: '1.5rem', margin: 0, fontWeight: 'bold', color: '#ffffff' }}>{totalEntries}</p>
          </div>
          <div style={{ border: '1px solid #233554', padding: '1rem', borderRadius: '8px', flex: 1, backgroundColor: '#1d2d50' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#8892b0' }}>Total Quantity</h3>
            <p style={{ fontSize: '1.5rem', margin: 0, fontWeight: 'bold', color: '#ffffff' }}>{totalStipendQuantity}</p>
          </div>
          <div style={{ border: '1px solid #233554', padding: '1rem', borderRadius: '8px', flex: 1, backgroundColor: '#1d2d50' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#8892b0' }}>Total Investment</h3>
            <p style={{ fontSize: '1.5rem', margin: 0, fontWeight: 'bold', color: '#4caf50' }}>${totalDollarAmount.toFixed(2)}</p>
          </div>
        </div>

       {/* Reporting Filters Layout */}
<div className="no-print" style={{ backgroundColor: '#112240', border: '1px solid #233554', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
  <div>
    <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px', color: '#8892b0' }}>Filter Staff:</label>
    <select value={reportStaffId} onChange={(e) => setReportStaffId(e.target.value)} style={{ padding: '0.4rem', backgroundColor: '#0a192f', color: '#ffffff', border: '1px solid #233554', borderRadius: '4px' }}>
      <option value="ALL">All Staff</option>
      {employees.map(emp => {
        const id = emp['Staff ID'] || emp['staffId'];
        const firstName = emp['First Name'] || emp['firstName'];
        const lastName = emp['Last Name'] || emp['lastName'];
        return (
          <option key={id} value={id}>{lastName}, {firstName}</option>
        );
      })}
    </select>
  </div>
  <div>
    <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px', color: '#8892b0' }}>Filter Stipend Type:</label>
    <select value={reportStipendTypeId} onChange={(e) => setReportStipendTypeId(e.target.value)} style={{ padding: '0.4rem', backgroundColor: '#0a192f', color: '#ffffff', border: '1px solid #233554', borderRadius: '4px' }}>
      <option value="ALL">All Types</option>
      {stipendTypes.map(t => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  </div>
  <div>
    <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px', color: '#8892b0' }}>Start Date:</label>
    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '0.35rem', backgroundColor: '#0a192f', color: '#ffffff', border: '1px solid #233554', borderRadius: '4px' }} />
  </div>
  <div>
    <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px', color: '#8892b0' }}>End Date:</label>
    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '0.35rem', backgroundColor: '#0a192f', color: '#ffffff', border: '1px solid #233554', borderRadius: '4px' }} />
  </div>

  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
    <button
      type="button"
      onClick={() => {
        setReportStaffId('ALL');
        setReportStipendTypeId('ALL');
        setStartDate('');
        setEndDate('');
      }}
      style={{
        padding: '0.45rem 1rem',
        backgroundColor: '#233554',
        color: '#8892b0',
        border: '1px solid #233554',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold'
      }}
    >
      ↺ Reset Filters
    </button>

    <button
      type="button"
      onClick={() => window.print()}
      style={{
        padding: '0.45rem 1rem',
        backgroundColor: '#2e7d32',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold'
      }}
    >
      🖨️ Print Report
    </button>
  </div>
</div>

        {/* Report Records Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#112240', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: '#1d2d50', borderBottom: '2px solid #233554', color: '#ffffff' }}>
              <th style={{ padding: '0.75rem' }}>Staff ID</th>
              <th style={{ padding: '0.75rem' }}>Employee</th>
              <th style={{ padding: '0.75rem' }}>Stipend Name</th>
              <th style={{ padding: '0.75rem' }}>Date</th>
              <th style={{ padding: '0.75rem' }}>Qty</th>
              <th style={{ padding: '0.75rem' }}>Rate</th>
              <th style={{ padding: '0.75rem' }}>Total</th>
              <th className="no-print" style={{ padding: '0.75rem', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStipends.map((item) => {
              const rate = getEffectiveRate(item);
              const quantity = item.quantity || 0;
              const empFirstName = item.Employee ? (item.Employee['First Name'] || item.Employee['firstName']) : '';
              const empLastName = item.Employee ? (item.Employee['Last Name'] || item.Employee['lastName']) : '';
              const empFullName = empFirstName || empLastName ? `${empFirstName} ${empLastName}`.trim() : 'Unknown';

              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #233554', color: '#ccd6f6' }}>
                  <td style={{ padding: '0.75rem' }}>{item.staff_id}</td>
                  <td style={{ padding: '0.75rem' }}>{empFullName}</td>
                  <td style={{ padding: '0.75rem' }}>{item.stipend_types?.name || 'Unknown'}</td>
                  <td style={{ padding: '0.75rem' }}>{item.effective_date}</td>
                  <td style={{ padding: '0.75rem' }}>{quantity}</td>
                  <td style={{ padding: '0.75rem' }}>${rate.toFixed(2)}</td>
                  <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#ffffff' }}>${(quantity * rate).toFixed(2)}</td>
                  <td className="no-print" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleDeleteStipend(item)}
                      title="Delete Entry"
                      style={{ padding: '0.3rem 0.6rem', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredStipends.length === 0 && (
              <tr>
                <td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: '#8892b0' }}>No stipends match the current filtering parameters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}