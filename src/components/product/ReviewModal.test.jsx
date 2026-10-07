import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReviewModal from './ReviewModal';

const product = {
  _id: 'product-1',
  name: 'Royal Zari Silk Saree',
  brand: 'Jassi General Store',
  images: [{ url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' }],
};

describe('ReviewModal', () => {
  test('requires a star rating and submits trimmed review content', async () => {
    const onSubmit = jest.fn().mockResolvedValue({ message: 'Your verified review is now visible.' });
    render(<ReviewModal open product={product} onClose={jest.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please select a rating');
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /5 stars.*Excellent/i }));
    fireEvent.change(screen.getByPlaceholderText('Summarise your experience'), { target: { value: '  Beautiful saree  ' } });
    fireEvent.change(screen.getByPlaceholderText(/Tell other customers/i), { target: { value: '  Great fabric and finish.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      rating: 5,
      title: 'Beautiful saree',
      comment: 'Great fabric and finish.',
    }));
    expect(await screen.findByText('Review saved')).toBeInTheDocument();
    expect(screen.getByText('Your verified review is now visible.')).toBeInTheDocument();
  });

  test('loads an existing review for editing and closes with Escape', () => {
    const onClose = jest.fn();
    render(
      <ReviewModal
        open
        product={product}
        existingReview={{ _id: 'review-1', rating: 3, title: 'Good', comment: 'Comfortable fit.' }}
        onClose={onClose}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Edit your review' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Summarise your experience')).toHaveValue('Good');
    expect(screen.getByPlaceholderText(/Tell other customers/i)).toHaveValue('Comfortable fit.');
    expect(screen.getByRole('button', { name: /3 stars.*Good/i })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('uploads photos and submits optional product-detail ratings', async () => {
    const onUpload = jest.fn().mockResolvedValue({ files: [{ url: 'https://media.example.test/review.webp' }] });
    const onSubmit = jest.fn().mockResolvedValue({ message: 'Saved' });
    const { container } = render(<ReviewModal open product={product} onClose={jest.fn()} onUpload={onUpload} onSubmit={onSubmit} />);
    const file = new File(['photo'], 'review.webp', { type: 'image/webp' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith([file]));
    expect(await screen.findByAltText('Review upload')).toHaveAttribute('src', 'https://media.example.test/review.webp');
    fireEvent.click(screen.getByRole('button', { name: /4 stars.*Very good/i }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Quality rating' }), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      rating: 4,
      title: '',
      comment: '',
      aspects: { quality: 5 },
      recommend: true,
      photos: ['https://media.example.test/review.webp'],
    }));
  });

  test('lets the customer withdraw an existing review', async () => {
    const onWithdraw = jest.fn().mockResolvedValue({ success: true });
    render(<ReviewModal open product={product} existingReview={{ _id: 'review-1', rating: 4 }} onClose={jest.fn()} onSubmit={jest.fn()} onWithdraw={onWithdraw} />);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw this review' }));
    await waitFor(() => expect(onWithdraw).toHaveBeenCalledWith(expect.objectContaining({ _id: 'review-1' })));
    expect(await screen.findByText('Review saved')).toBeInTheDocument();
  });
});
