export default function TestPage() {
  return (
    <div style={{ 
      backgroundColor: 'white', 
      color: 'black', 
      padding: '20px',
      minHeight: '100vh'
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
        ✅ Test Page Working!
      </h1>
      <p>This is a simple test page with inline styles.</p>
      <p>If you can see this, the Next.js app is working correctly.</p>
      
      <div style={{
        backgroundColor: '#f0f0f0',
        padding: '10px',
        marginTop: '20px',
        border: '1px solid #ccc'
      }}>
        <strong>Status:</strong> Page rendering successfully
      </div>
    </div>
  )
}