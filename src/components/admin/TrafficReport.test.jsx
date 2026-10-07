import { render, screen, fireEvent } from '@testing-library/react';
import TrafficReport from './TrafficReport';
import '@testing-library/jest-dom';
const data = { timezone: 'Asia/Kolkata', health: { state: 'collecting' }, metrics: { visitors: { value: 12 }, sessions: { value: 18 }, pageViews: { value: 45 } }, activeVisitors: 2, range: { days: 1 }, series: [{ key: '12:00', visitors: 12, sessions: 18, pageViews: 45 }], sources: [{ label: 'instagram', sessions: 18, visitors: 12, pageViews: 45 }], funnel: { steps: [{ label: 'Visits started', value: 18, rate: 100 }], conversionRate: 10, engagementRate: 60, bounceRate: 40 }, commerce: { ordersPlaced: 3, codPlaced: 2 }, definitions: { visitors: 'Anonymous browser estimates.' } };
test('premium traffic dashboard distinguishes visitors, visits, active users and verified sales', () => {
  render(<TrafficReport data={data} />);
  expect(screen.getByText('Unique visitors')).toBeInTheDocument(); expect(screen.getByText('2 active visitors')).toBeInTheDocument();
  expect(screen.getByText('Verified visitor-to-order funnel')).toBeInTheDocument(); expect(screen.getByText('Verified order cohort')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Traffic settings' })).toHaveAttribute('href', '/admin/settings');
  fireEvent.click(screen.getByRole('button', { name: 'Page views' })); expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'pageViews across the selected period');
});
test.each(['disabled', 'awaiting_data', 'delayed'])('collection state %s is not disguised as successful zero traffic', state => {
  render(<TrafficReport data={{ ...data, health: { state }, retention: { detailsPartial: true, rawDays: 90, summaryDays: 365 } }} />);
  expect(screen.getByRole('status')).toBeInTheDocument(); expect(screen.getByText(/Detailed page\/product\/search rankings/)).toBeInTheDocument();
});
