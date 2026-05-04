export default function AlertsPanel({ alerts }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Smart Alerts</h2>
      </div>

      <div className="alerts-list">
        {alerts.map((alert, index) => (
          <div className={`notice ${alert.type}`} key={`${alert.message}-${index}`}>
            {alert.message}
          </div>
        ))}
      </div>
    </section>
  );
}
