import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

import { useState } from 'react';

// Set your private access code here
const ACCESS_CODE = "jmcss2026"; 

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("app_authenticated") === "true"
  );
  const [inputCode, setInputCode] = useState("");
  const [error, setError] = useState(false);

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

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <form onSubmit={handleLogin} style={{ padding: '2rem', border: '1px solid #ccc', borderRadius: '8px', textAlign: 'center' }}>
          <h2>JMCSS Stipend Tracker</h2>
          <p>Please enter the access code to proceed:</p>
          <input 
            type="password" 
            value={inputCode} 
            onChange={(e) => setInputCode(e.target.value)} 
            placeholder="Enter access code"
            style={{ padding: '8px', fontSize: '16px', marginBottom: '10px', width: '80%' }}
          />
          <br />
          <button type="submit" style={{ padding: '8px 16px', fontSize: '16px', cursor: 'pointer' }}>Enter</button>
          {error && <p style={{ color: 'red', marginTop: '10px' }}>Incorrect access code.</p>}
        </form>
      </div>
    );
  }

  // Your existing Stipend Tracker UI code goes here...
  return (
    <div>
      {/* Existing App JSX */}
    </div>
  );
}

function App() {
  const [employees, setEmployees] = useState([])
  const [stipendTypes, setStipendTypes] = useState([])
  
  // Entry Form State
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [selectedStipendId, setSelectedStipendId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [customRate, setCustomRate] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  
  // Records & Data State
  const [stipendsList, setStipendsList] = useState([])
  const [loading, setLoading] = useState(true)

  // Reporting / Filter State
  const [reportStaffId, setReportStaffId] = useState('ALL')
  const [reportStipendTypeId, setReportStipendTypeId] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: empData, error: empErr } = await supabase.from('Employee').select('*')
    const { data: typeData } = await supabase.from('stipend_types').select('*')
    const { data: stipendData } = await supabase
      .from('employee_stipends')
      .select('*, Employee("First Name", "Last Name"), stipend_types(*)')

    if (empErr) console.error('Employee Fetch Error:', empErr)
    if (empData) setEmployees(empData)
    if (typeData) setStipendTypes(typeData)
    if (stipendData) setStipendsList(stipendData)
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedStaffId || !selectedStipendId || !effectiveDate) return

    const { error } = await supabase.from('employee_stipends').insert([
      {
        staff_id: selectedStaffId,
        stipend_type_id: selectedStipendId,
        quantity: parseInt(quantity) || 1,
        custom_rate: customRate ? parseFloat(customRate) : null,
        effective_date: effectiveDate
      }
    ])

    if (!error) {
      setQuantity(1)
      setCustomRate('')
      setEffectiveDate('')
      fetchData()
    } else {
      alert(error.message)
    }
  }

  // Helper function to resolve rate per item ($18 default)
  function getEffectiveRate(item) {
    if (item.custom_rate !== null && item.custom_rate !== undefined && item.custom_rate !== '') {
      return parseFloat(item.custom_rate)
    }
    return item.stipend_types?.rate || item.stipend_types?.amount || 18
  }

  // Filter stipends based on report controls
  const filteredStipends = stipendsList.filter((item) => {
    if (reportStaffId !== 'ALL' && String(item.staff_id) !== String(reportStaffId)) {
      return false
    }
    if (reportStipendTypeId !== 'ALL' && String(item.stipend_type_id) !== String(reportStipendTypeId)) {
      return false
    }
    if (startDate && item.effective_date && item.effective_date < startDate) {
      return false
    }
    if (endDate && item.effective_date && item.effective_date > endDate) {
      return false
    }
    return true
  })

  // Aggregate Metrics
  const totalEntries = filteredStipends.length
  const totalStipendQuantity = filteredStipends.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const totalDollarAmount = filteredStipends.reduce((sum, item) => {
    const rate = getEffectiveRate(item)
    const qty = item.quantity || 0
    return sum + (qty * rate)
  }, 0)

  if (loading) return <div style={{ padding: '2rem' }}>Loading database...</div>

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Employee Stipend Tracker</h1>

      {/* Entry Form */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <h2 style={{ marginTop: 0 }}>Log New Stipend</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Employee:</label>
            <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} required style={{ padding: '0.5rem' }}>
              <option value="">Select Employee</option>
              {employees.map((emp) => (
                <option key={emp['Staff ID']} value={emp['Staff ID']}>
                  {emp['First Name']} {emp['Last Name']} ({emp['Staff ID']})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Stipend Type:</label>
            <select value={selectedStipendId} onChange={(e) => setSelectedStipendId(e.target.value)} required style={{ padding: '0.5rem' }}>
              <option value="">Select Stipend Type</option>
              {stipendTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Qty:</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              style={{ padding: '0.45rem', width: '60px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Custom Rate ($):</label>
            <input
              type="number"
              step="0.01"
              placeholder="Default: $18"
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              style={{ padding: '0.45rem', width: '110px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Effective Date:</label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              required
              style={{ padding: '0.45rem' }}
            />
          </div>

          <button type="submit" style={{ padding: '0.55rem 1rem', cursor: 'pointer', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px' }}>
            Add Stipend
          </button>
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
              const rate = getEffectiveRate(item)
              const lineTotal = (item.quantity || 0) * rate
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
  )
}

export default App