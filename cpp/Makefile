CXX ?= clang++
CXXFLAGS := -std=c++17 -O2 -Wall -Wextra -Iinclude

all: build/dsa_engine build/test_dsa

build:
	mkdir -p build

build/dsa_engine: src/dsa_engine.cpp include/*.hpp | build
	$(CXX) $(CXXFLAGS) src/dsa_engine.cpp -o build/dsa_engine

build/test_dsa: tests/test_dsa.cpp include/*.hpp | build
	$(CXX) $(CXXFLAGS) tests/test_dsa.cpp -o build/test_dsa

test: build/test_dsa
	./build/test_dsa

clean:
	rm -rf build
