import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getTrip, updateTripStatus, assignTrip, createExpense, approveExpense, uploadDocument, createInvoice, updateInvoiceStatus, getVehicles, getDrivers, downloadExpenseReport, downloadDocument, downloadTripDocuments, viewInvoicePDF } from '../utils/api';

const DOC_TYPES = ['Delivery Receipt','Invoice Copy','Fuel Bill','Toll Receipt','Other'];
const EXP_TYPES = ['Fuel','Toll','Repair','Other'];
const STATUSES = ['Pending','Accepted','Dispatched','In Transit','Delivered','Returned'];

function SBadge({ status }) {
  const m = { Pending:'created', Accepted:'dispatched', Dispatched:'dispatched', 'In Transit':'in-transit', Delivered:'delivered', Returned:'returned' };
  return <span className={`badge badge-${m[status]||'created'}`}>{status}</span>;
}

export default function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCompany = user?.role === 'company';
  const isDriver  = user?.role === 'driver';

  const [trip, setTrip] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [assignForm, setAssignForm] = useState({ vehicle_id:'', driver_id:'' });
  const [expForm, setExpForm] = useState({ expense_type:'Fuel', amount:'', date:new Date().toISOString().slice(0,10), notes:'' });
  const [receiptFile, setReceiptFile] = useState(null);
  const [docFile, setDocFile] = useState(null);
  const [docType, setDocType] = useState('Delivery Receipt');
  const [invForm, setInvForm] = useState({ customer_name:'', freight_rate:'' });

  const load = useCallback(async () => {
    const reqs = [getTrip(id)];
    if (isCompany) { reqs.push(getVehicles()); reqs.push(getDrivers()); }
    const [t, v, d] = await Promise.all(reqs);
    setTrip(t.data);
    if (v) setVehicles(v.data);
    if (d) setDrivers(d.data);
    setLoading(false);
  }, [id, isCompany]);

  useEffect(() => { load(); }, [load]);

  const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);

  const handleDownload = async (fn) => {
    setDownloading(true);
    try { await fn(); } catch(e) { alert('Download failed'); }
    setDownloading(false);
  };

  if (loading) return <div className="loading"><div className="spinner"/>Loading...</div>;
  if (!trip)   return <div className="loading">Trip not found</div>;

  const totalExpApproved = trip.expenses?.filter(e=>e.status==='Approved').reduce((s,e)=>s+e.amount,0)||0;
  const statusIdx = STATUSES.indexOf(trip.status);

  const tabs = ['overview'];
  if (isCompany) tabs.push('assign');
  tabs.push('expenses','documents','invoice','updates');

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <button onClick={()=>navigate('/trips')} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontFamily:'var(--font-mono)',fontSize:11}}>TRIPS</button>
            {' / '}<span style={{color:'var(--text2)'}}>{id.slice(0,8)}...</span>
          </div>
          <h2>{trip.pickup} → {trip.destination}</h2>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <SBadge status={trip.status}/>
          {(isCompany||isDriver) && (
            <select className="form-select" style={{width:150}} value={trip.status} onChange={e=>{setSaving(true);updateTripStatus(id,e.target.value).then(load).finally(()=>setSaving(false))}}>
              {STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Progress bar */}
        <div className="card mb-6">
          <div style={{display:'flex',alignItems:'center'}}>
            {STATUSES.map((s,i)=>(
              <React.Fragment key={s}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',flex:1}}>
                  <div style={{width:30,height:30,borderRadius:'50%',background:i<=statusIdx?(i===statusIdx?'var(--accent)':'var(--green)'):'var(--bg3)',border:`2px solid ${i<=statusIdx?(i===statusIdx?'var(--accent)':'var(--green)'):'var(--border2)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>
                    {i<statusIdx?'✓':i===statusIdx?'●':'○'}
                  </div>
                  <div style={{marginTop:6,fontSize:9,fontFamily:'var(--font-mono)',color:i<=statusIdx?'var(--text)':'var(--text3)',textAlign:'center'}}>{s}</div>
                </div>
                {i<STATUSES.length-1&&<div style={{flex:2,height:2,background:i<statusIdx?'var(--green)':'var(--border2)',marginBottom:20}}/>}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="grid-4 mb-6">
          <div className="stat-card amber"><div className="stat-label">Distance</div><div className="stat-value" style={{fontSize:22}}>{trip.distance}</div><div className="stat-sub">km</div></div>
          <div className="stat-card blue"><div className="stat-label">Vehicle</div><div className="stat-value" style={{fontSize:14}}>{trip.registration||'TBD'}</div><div className="stat-sub">{trip.driver_name||'No driver'}</div></div>
          <div className="stat-card red"><div className="stat-label">Expenses (Approved)</div><div className="stat-value red" style={{fontSize:18}}>{fmt(totalExpApproved)}</div><div className="stat-sub">{trip.expenses?.filter(e=>e.status==='Pending').length||0} pending</div></div>
          <div className="stat-card green"><div className="stat-label">Invoice</div><div className="stat-value green" style={{fontSize:18}}>{trip.invoice?fmt(trip.invoice.total_amount):'--'}</div><div className="stat-sub">{trip.invoice?.status||'Not created'}</div></div>
        </div>

        <div className="tabs">
          {tabs.map(t=>(
            <button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
              {t==='expenses'&&trip.expenses?.filter(e=>e.status==='Pending').length>0&&<span style={{marginLeft:4,background:'var(--accent)',color:'#000',borderRadius:10,padding:'1px 5px',fontSize:9,fontWeight:700}}>{trip.expenses.filter(e=>e.status==='Pending').length}</span>}
            </button>
          ))}
        </div>

        {tab==='overview'&&(
          <div className="grid-2">
            <div className="card">
              <div className="card-title mb-4">Trip Details</div>
              {[['Customer',trip.customer_name||(trip.customer_company||'--')],['Driver',trip.driver_name||'--'],['Driver Phone',trip.driver_phone||'--'],['Cargo',trip.cargo_type],['Pickup',trip.pickup],['Destination',trip.destination],['Distance',`${trip.distance} km`],['Notes',trip.notes||'--'],['Created',new Date(trip.created_at).toLocaleDateString('en-IN')]].map(([k,v])=>(
                <div key={k} style={{display:'flex',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{width:130,fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text3)',textTransform:'uppercase'}}>{k}</span>
                  <span style={{color:'var(--text)'}}>{v}</span>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="flex-between mb-4">
                <div className="card-title">Financials</div>
                <button className="btn btn-secondary btn-sm" onClick={()=>handleDownload(()=>downloadExpenseReport({trip_id:id}))} disabled={downloading}>
                  {downloading ? '...' : 'Download Excel'}
                </button>
              </div>
              <table className="data-table">
                <thead><tr><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>{(trip.expenses||[]).map(e=>(
                  <tr key={e.id}>
                    <td><span className="badge badge-dispatched">{e.expense_type}</span></td>
                    <td className="text-mono text-red">{fmt(e.amount)}</td>
                    <td><span className={`badge ${e.status==='Approved'?'badge-delivered':e.status==='Rejected'?'badge-maintenance':'badge-created'}`}>{e.status}</span></td>
                  </tr>
                ))}</tbody>
              </table>
              {trip.invoice&&<div style={{padding:'10px 14px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between'}}>
                <span className="text-mono" style={{fontSize:11,color:'var(--text3)'}}>NET PROFIT</span>
                <span className={`text-mono font-bold ${trip.invoice.total_amount-totalExpApproved>=0?'text-green':'text-red'}`}>{fmt(trip.invoice.total_amount-totalExpApproved)}</span>
              </div>}
            </div>
          </div>
        )}

        {tab==='assign'&&isCompany&&(
          <div className="card" style={{maxWidth:500}}>
            <div className="card-title mb-4">Assign Vehicle & Driver</div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Vehicle (Available Only)</label>
                <select className="form-select" value={assignForm.vehicle_id} onChange={e=>setAssignForm({...assignForm,vehicle_id:e.target.value})}>
                  <option value="">-- Select vehicle --</option>
                  {vehicles.filter(v=>v.status==='Available').map(v=><option key={v.id} value={v.id}>{v.registration} ({v.type}, {v.capacity}T)</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Driver</label>
                <select className="form-select" value={assignForm.driver_id} onChange={e=>setAssignForm({...assignForm,driver_id:e.target.value})}>
                  <option value="">-- Select driver --</option>
                  {drivers.map(d=><option key={d.id} value={d.id}>{d.name}{d.phone?` (${d.phone})`:''}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={async()=>{setSaving(true);await assignTrip(id,assignForm);await load();setSaving(false);}} disabled={saving||!assignForm.vehicle_id||!assignForm.driver_id}>
                {saving?'Assigning...':'Assign & Accept Trip'}
              </button>
            </div>
            {trip.status!=='Pending'&&<div style={{marginTop:16,padding:10,background:'rgba(16,185,129,0.05)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:6,fontSize:12,color:'var(--green)'}}>Assigned: {trip.registration||'--'} / {trip.driver_name||'--'}</div>}
          </div>
        )}

        {tab==='expenses'&&(
          <div className="grid-2">
            {(isCompany||isDriver)&&(
              <div className="card">
                <div className="card-title mb-4">Log Expense</div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Type</label><select className="form-select" value={expForm.expense_type} onChange={e=>setExpForm({...expForm,expense_type:e.target.value})}>{EXP_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Amount (INR)</label><input className="form-input" type="number" value={expForm.amount} onChange={e=>setExpForm({...expForm,amount:e.target.value})} placeholder="0.00"/></div>
                  <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={expForm.date} onChange={e=>setExpForm({...expForm,date:e.target.value})}/></div>
                  <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={expForm.notes} onChange={e=>setExpForm({...expForm,notes:e.target.value})} placeholder="Details"/></div>
                  <div className="form-group"><label className="form-label">Receipt</label><input className="form-input" type="file" accept="image/*,.pdf" onChange={e=>setReceiptFile(e.target.files[0])}/></div>
                  <button className="btn btn-primary" disabled={saving||!expForm.amount} onClick={async()=>{setSaving(true);await createExpense({trip_id:id,...expForm}, receiptFile);await load();setExpForm({expense_type:'Fuel',amount:'',date:new Date().toISOString().slice(0,10),notes:''});setReceiptFile(null);setSaving(false);}}>Submit</button>
                </div>
              </div>
            )}
            <div className="card">
              <div className="flex-between mb-4">
                <div className="card-title">All Expenses</div>
                <button className="btn btn-secondary btn-sm" onClick={()=>handleDownload(()=>downloadExpenseReport({trip_id:id}))} disabled={downloading}>
                  {downloading ? '...' : 'Download Excel'}
                </button>
              </div>
              <table className="data-table">
                <thead><tr><th>Type</th><th>Amt</th><th>By</th><th>Status</th>{isCompany&&<th>Action</th>}</tr></thead>
                <tbody>{(trip.expenses||[]).map(e=>(
                  <tr key={e.id}>
                    <td><span className="badge badge-dispatched">{e.expense_type}</span></td>
                    <td className="text-mono text-red">{fmt(e.amount)}</td>
                    <td style={{fontSize:11}}>{e.submitted_by_name||'--'}</td>
                    <td><span className={`badge ${e.status==='Approved'?'badge-delivered':e.status==='Rejected'?'badge-maintenance':'badge-created'}`}>{e.status}</span></td>
                    {isCompany&&<td>{e.status==='Pending'&&<div style={{display:'flex',gap:4}}>
                      <button style={{background:'rgba(16,185,129,0.15)',color:'var(--green)',border:'none',cursor:'pointer',padding:'3px 8px',borderRadius:4,fontSize:10,fontWeight:700}} onClick={()=>approveExpense(e.id,'Approved').then(load)}>Approve</button>
                      <button style={{background:'rgba(239,68,68,0.15)',color:'var(--red)',border:'none',cursor:'pointer',padding:'3px 8px',borderRadius:4,fontSize:10,fontWeight:700}} onClick={()=>approveExpense(e.id,'Rejected').then(load)}>Reject</button>
                    </div>}</td>}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='documents'&&(
          <div className="grid-2">
            <div className="card">
              <div className="card-title mb-4">Upload Document</div>
              <div className="form-grid">
                <div className="form-group"><label className="form-label">Type</label><select className="form-select" value={docType} onChange={e=>setDocType(e.target.value)}>{DOC_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div className="form-group"><label className="form-label">File</label><input className="form-input" type="file" onChange={e=>setDocFile(e.target.files[0])}/></div>
                <button className="btn btn-primary" disabled={saving||!docFile} onClick={async()=>{setSaving(true);await uploadDocument(id,docType,docFile);await load();setDocFile(null);setSaving(false);}}>Upload</button>
              </div>
            </div>
            <div className="card">
              <div className="flex-between mb-4">
                <div className="card-title">Documents</div>
                {trip.documents?.length>0&&<button className="btn btn-secondary btn-sm" onClick={()=>handleDownload(()=>downloadTripDocuments(id))} disabled={downloading}>{downloading?'...':'Download ZIP'}</button>}
              </div>
              {trip.documents?.length>0?(
                <table className="data-table">
                  <thead><tr><th>Type</th><th>File</th><th>By</th><th></th></tr></thead>
                  <tbody>{trip.documents.map(d=>(
                    <tr key={d.id}>
                      <td><span className="badge badge-on-trip">{d.doc_type}</span></td>
                      <td style={{fontSize:11}}>{d.original_name}</td>
                      <td style={{fontSize:11}}>{d.uploaded_by_name||'--'}</td>
                      <td><button className="btn btn-sm btn-secondary" onClick={()=>downloadDocument(d.id, d.original_name)}>Download</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              ):<div className="empty-state"><p>No documents</p></div>}
            </div>
          </div>
        )}

        {tab==='invoice'&&(
          <div>
            {isCompany&&!trip.invoice&&(
              <div className="card mb-4" style={{maxWidth:500}}>
                <div className="card-title mb-4">Generate Invoice</div>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Customer Name *</label><input className="form-input" placeholder="Dept/Organization" value={invForm.customer_name} onChange={e=>setInvForm({...invForm,customer_name:e.target.value})}/></div>
                  <div className="form-group"><label className="form-label">Rate (INR/km) *</label><input className="form-input" type="number" placeholder="e.g. 15" value={invForm.freight_rate} onChange={e=>setInvForm({...invForm,freight_rate:e.target.value})}/></div>
                  {invForm.freight_rate&&<div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:12}}>
                    <div className="text-mono" style={{fontSize:11,color:'var(--text3)'}}>PREVIEW: {trip.distance} km x INR {invForm.freight_rate}</div>
                    <div style={{fontSize:22,fontFamily:'var(--font-mono)',color:'var(--green)',fontWeight:700}}>{fmt(invForm.freight_rate*trip.distance)}</div>
                  </div>}
                  <button className="btn btn-primary" disabled={saving||!invForm.customer_name||!invForm.freight_rate} onClick={async()=>{setSaving(true);await createInvoice({trip_id:id,customer_name:invForm.customer_name,freight_rate:invForm.freight_rate,distance:trip.distance,customer_id:trip.customer_id});await load();setSaving(false);}}>Generate</button>
                </div>
              </div>
            )}
            {trip.invoice&&(
              <div className="card">
                <div className="flex-between mb-4">
                  <div className="card-title">Invoice #{trip.invoice.id.slice(0,8).toUpperCase()}</div>
                  <div style={{display:'flex',gap:8}}>
                    <a href={viewInvoicePDF(trip.invoice.id)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Print/PDF</a>
                    {isCompany&&<select className="form-select" style={{width:130}} value={trip.invoice.status} onChange={e=>updateInvoiceStatus(trip.invoice.id,e.target.value).then(load)}>
                      {['Draft','Sent','Paid','Cancelled'].map(s=><option key={s}>{s}</option>)}
                    </select>}
                  </div>
                </div>
                <table className="data-table">
                  <thead><tr><th>Customer</th><th>Distance</th><th>Rate</th><th>Revenue</th><th>Expenses</th><th>Profit</th><th>Status</th></tr></thead>
                  <tbody><tr>
                    <td>{trip.invoice.customer_name}</td>
                    <td className="text-mono">{trip.invoice.distance} km</td>
                    <td className="text-mono">INR {trip.invoice.freight_rate}/km</td>
                    <td className="text-mono text-green" style={{fontWeight:700}}>{fmt(trip.invoice.total_amount)}</td>
                    <td className="text-mono text-red">{fmt(totalExpApproved)}</td>
                    <td className={`text-mono font-bold ${trip.invoice.total_amount-totalExpApproved>=0?'text-green':'text-red'}`}>{fmt(trip.invoice.total_amount-totalExpApproved)}</td>
                    <td><span className={`badge ${trip.invoice.status==='Paid'?'badge-delivered':trip.invoice.status==='Sent'?'badge-dispatched':'badge-created'}`}>{trip.invoice.status}</span></td>
                  </tr></tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab==='updates'&&(
          <div className="card">
            <div className="card-title mb-4">Driver Journey Updates</div>
            {trip.driver_updates?.length>0?(
              <div style={{maxWidth:600}}>
                {[...trip.driver_updates].reverse().map((u,i)=>(
                  <div key={u.id} style={{display:'flex',gap:16,paddingBottom:20,position:'relative'}}>
                    {i<trip.driver_updates.length-1&&<div style={{position:'absolute',left:15,top:32,bottom:0,width:2,background:'var(--border)'}}/>}
                    <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(245,158,11,0.2)',border:'2px solid var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                      {u.update_type==='Fuel Stop'?'F':u.update_type==='Toll Paid'?'T':u.update_type==='Delivered'?'D':u.update_type==='Delay'?'!':'C'}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14}}>{u.update_type}</div>
                      {u.message&&<div style={{fontSize:13,color:'var(--text2)',marginTop:4}}>{u.message}</div>}
                      {u.lat&&<div style={{fontSize:11,fontFamily:'var(--font-mono)',color:'var(--text3)',marginTop:4}}>GPS: {parseFloat(u.lat).toFixed(4)}, {parseFloat(u.lng).toFixed(4)}</div>}
                      {u.photo_file&&<a href={`/uploads/${u.photo_file}`} target="_blank" rel="noreferrer" style={{display:'inline-block',marginTop:8,fontSize:11,color:'var(--blue2)'}}>View Photo</a>}
                      <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>{new Date(u.created_at).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            ):<div className="empty-state"><div className="empty-icon">GPS</div><p>No driver updates yet</p></div>}
          </div>
        )}
      </div>
    </>
  );
}
