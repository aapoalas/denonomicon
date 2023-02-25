#include <functional>
#include <stdio.h>
#include <iostream>

#include <functional>

namespace example_lib {
int print_num(int i, int j) { std::cout << i << j << '\n'; return 3; }
struct PrintNum {
  void operator()(int i) const { std::cout << i << '\n'; }
};
typedef void (*Callback)(void *userdata, void *userdata2);
class PartiallyVirtualClass {
public:
  PartiallyVirtualClass(int data);
  virtual ~PartiallyVirtualClass();

  static void callDoDataMethod(PartiallyVirtualClass *instance);
  static void callDelete(PartiallyVirtualClass *instance);
  static void callLambda(const std::function<int(int, int)> &lambda);

  std::function<int(int, int)> &createLambda(std::function<int(int, int)> *out,
                                      Callback callback, void *userdata,
                                      void *userdata2);
  virtual void doData(int data);
  virtual void useData(int data);
  virtual void maybeData() = 0;

private:
  int data_;
  std::function<int(int, int)> callback_;
};

class Derived : PartiallyVirtualClass {
public:
  ~Derived();

  void doData(int data) override;
  void maybeData() override;
};
PartiallyVirtualClass::PartiallyVirtualClass(int data)
    : data_(data), callback_(nullptr) {}

PartiallyVirtualClass::~PartiallyVirtualClass() { useData(data_); }

void PartiallyVirtualClass::callDoDataMethod(PartiallyVirtualClass *instance) {
  instance->doData(313);
}

void PartiallyVirtualClass::callDelete(PartiallyVirtualClass *instance) {
  instance->~PartiallyVirtualClass();
}

std::function<int(int, int)> &
PartiallyVirtualClass::createLambda(std::function<int(int, int)> *out,
                                    Callback callback, void *userdata,
                                    void *userdata2) {
  std::function<int(int, int)> cb = print_num;
  *out = cb;
  if (!callback_) {
    callback_ = cb;
  }
  return callback_;
}

void PartiallyVirtualClass::callLambda(const std::function<int(int, int)> &lambda) {
  printf("Lambda returned: %i\n", lambda(1234, 4567));
}

void PartiallyVirtualClass::useData(int data) {
  printf("Base class: %i\n", data);
}

void PartiallyVirtualClass::doData(int data) {
  printf("Base class doData: %i\n", data);
}

Derived::~Derived() { this->useData(666); }

void Derived::doData(int data) { printf("Derived class doData: %i\n", data); }
void Derived::maybeData() { printf("Derived class maybeData\n"); }
} // namespace example_lib