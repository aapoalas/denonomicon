#include <cstdio>

namespace lib {
class Example {
public:
  Example(int data);
  ~Example();
  void method() const;
  static Example create(int data);

private:
  int data_;
};

Example::Example(int data) : data_{data} {}

Example::~Example() { printf("Deleting data: %i\n", data_); }

void Example::method() const { printf("Method data: %i\n", data_); }

Example Example::create(int data) { return Example(data); }
} // namespace lib